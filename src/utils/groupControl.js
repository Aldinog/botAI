const allowedGroups = process.env.ALLOWED_GROUP_IDS
  ? process.env.ALLOWED_GROUP_IDS.split(",").map(id => id.trim())
  : [];

function isAllowedGroup(chatId) {
  return allowedGroups.includes(chatId.toString());
}

module.exports = { isAllowedGroup };
