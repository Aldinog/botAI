const allowedGroups = process.env.ALLOWED_GROUP_IDS
  ? process.env.ALLOWED_GROUP_IDS.split(",").map(id => id.trim())
  : [];

function isAllowedGroup(chatId) {
  if (allowedGroups.length === 0) return true; // Allow all if not restricted
  return allowedGroups.includes(chatId.toString());
}

module.exports = { isAllowedGroup };
