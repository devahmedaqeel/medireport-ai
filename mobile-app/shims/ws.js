// Safe WebSocket shim for Expo Go
// React Native has a global WebSocket - we just re-export it safely
const RNWebSocket = global.WebSocket || null;

// Do NOT throw if WebSocket is undefined at module load time
// It is available at runtime in RN/Expo but may not be at import-parse time on some bundlers
module.exports = RNWebSocket;
module.exports.WebSocket = RNWebSocket;
module.exports.default = RNWebSocket;
