/**
 * Auth middleware — redirect unauthenticated users to /login.
 * Exported both as the default function and as a named `.requireAuth`
 * so `require('./middleware/auth')` and `{ requireAuth }` both work.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;