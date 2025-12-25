const { validateTelegramInitData } = require('../../src/utils/auth');
const { supabase } = require('../../src/utils/supabase');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { initData } = req.body;

    if (!initData) {
        return res.status(400).json({ error: 'initData is required' });
    }

    // 1. Validate initData
    const telegramUser = validateTelegramInitData(initData);
    if (!telegramUser) {
        return res.status(401).json({ error: 'Invalid Telegram data' });
    }

    const telegram_user_id = telegramUser.id;
    const telegram_username = telegramUser.username;

    try {
        // 2. Check group membership
        // Ensure bot is an admin in the group
        if (!process.env.TELEGRAM_TOKEN) {
            return res.status(500).json({ error: 'System configuration error: TELEGRAM_TOKEN not set' });
        }

        const groupIds = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
        if (groupIds.length === 0) {
            return res.status(500).json({ error: 'System configuration error: Group IDs not set' });
        }

        let isMember = false;
        // Check membership in the first allowed group (Aston Group)
        const primaryGroupId = groupIds[0];

        try {
            const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getChatMember`, {
                params: {
                    chat_id: primaryGroupId,
                    user_id: telegram_user_id
                }
            });

            const status = response.data.result.status;
            // allowed statuses: creator, administrator, member
            if (['creator', 'administrator', 'member'].includes(status)) {
                isMember = true;
            }
        } catch (error) {
            console.error('Telegram getChatMember error:', error.response?.data || error.message);
            return res.status(403).json({ error: 'Unable to verify group membership' });
        }

        if (!isMember) {
            return res.status(403).json({
                error: 'Silahkan join grup dulu untuk akses bot',
                code: 'NOT_MEMBER'
            });
        }

        // 3. User Registration/Update Logic
        // Find user or create
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_user_id', telegram_user_id)
            .single();

        let targetUser = user;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

        if (userError && userError.code === 'PGRST116') {
            // User not found, create new
            // Requirement: generate password random, simpan password_hash
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(16).toString('hex');

            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    telegram_user_id,
                    telegram_username,
                    password_hash: randomPassword, // Placeholder for the required field
                    expires_at: expiresAt.toISOString(),
                    last_login: now.toISOString()
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            targetUser = newUser;
        } else if (user) {
            // User exists, update last_login and potentially renew expires_at if it's a "re-registration"
            // The request said: After expired, user harus register ulang
            // If they are logging in while expired, we refresh the window if they are still in the group.

            const updateData = {
                last_login: now.toISOString(),
                telegram_username // Keep username updated
            };

            // If expired or near expiry, renew for 3 days
            if (new Date(user.expires_at) < now) {
                updateData.expires_at = expiresAt.toISOString();
            }

            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) throw updateError;
            targetUser = updatedUser;
        } else {
            throw userError;
        }

        // 4. Double check expiry strictly
        if (new Date(targetUser.expires_at) < now) {
            return res.status(403).json({ error: 'Your access has expired. Please re-register.' });
        }

        // 5. Fetch Global Settings
        // 5. Fetch Global Settings
        const { data: appSettings } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['maintenance_mode', 'maintenance_end_time', 'active_theme']);

        const settingsMap = {};
        if (appSettings) {
            appSettings.forEach(item => settingsMap[item.key] = item.value);
        }

        let maintenanceMode = settingsMap['maintenance_mode'] || false;
        let maintenanceEndTime = settingsMap['maintenance_end_time'];
        const activeTheme = settingsMap['active_theme'] || 'default';
        const isAdmin = targetUser.telegram_user_id.toString() === (process.env.ADMIN_ID || '');

        // Auto-Disable Logic (Sync with web.js)
        if (maintenanceMode && maintenanceEndTime) {
            const now = new Date();
            const end = new Date(maintenanceEndTime);
            if (now >= end) {
                // Auto Turn Off
                await supabase.from('app_settings').upsert([
                    { key: 'maintenance_mode', value: false },
                    { key: 'maintenance_end_time', value: null }
                ]);
                maintenanceMode = false;
                maintenanceEndTime = null;
            }
        }

        // BLOCKING LOGIC: If Maintenance is ON and NOT Admin
        if (maintenanceMode && !isAdmin) {
            return res.status(503).json({
                error: 'Mohon maaf APP masih maintenance',
                code: 'MAINTENANCE_MODE',
                end_time: maintenanceEndTime // Return time for countdown
            });
        }

        // 6. Generate Session Token (JWT)
        const token = jwt.sign(
            { id: targetUser.id, telegram_user_id: targetUser.telegram_user_id, is_admin: isAdmin },
            process.env.JWT_SECRET || 'fallback-secret-aston',
            { expiresIn: '3d' }
        );

        // Store session in database (optional but requested in schema)
        await supabase
            .from('sessions')
            .insert([{
                user_id: targetUser.id,
                token,
                expires_at: expiresAt.toISOString()
            }]);

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: targetUser.id,
                telegram_user_id: targetUser.telegram_user_id,
                username: targetUser.telegram_username,
                expires_at: targetUser.expires_at,
                is_maintenance: maintenanceMode,
                maintenance_end_time: maintenanceEndTime, // Added for Admin Dashboard Countdown
                is_admin: isAdmin,
                active_theme: activeTheme
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message || error,
            hint: 'Check if you have run the SQL initialization in Supabase and set all environment variables in Vercel.'
        });
    }
};
