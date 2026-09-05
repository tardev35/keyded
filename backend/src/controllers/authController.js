import { register, login, refresh, currentUser } from "../services/auth.js";

export async function postRegister(req, res, next) {
  try {
    return res.status(201).json(await register(req.body || {}));
  } catch (err) {
    return next(err);
  }
}

export async function postLogin(req, res, next) {
  try {
    return res.json(await login(req.body || {}));
  } catch (err) {
    return next(err);
  }
}

export async function postRefresh(req, res, next) {
  try {
    return res.json(await refresh(req.body?.refreshToken));
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    return res.json({ user: await currentUser(req.user.id) });
  } catch (err) {
    return next(err);
  }
}
