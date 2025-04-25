const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db')


router.post('/', async (req, res) => {
    try {
        const { user, password, type } = req.body;
        let query, params, result, sessionKey;

        params = [user];

        if (type === "admin") {
            if (/^\d+$/.test(user)) {
                query = `SELECT admin_id AS user_id, admin_password AS user_password, admin_session_key FROM admin WHERE admin_id = $1`;
            } else {
                query = `SELECT admin_id AS user_id, admin_password AS user_password, admin_session_key FROM admin WHERE admin_email = $1`;
            }
        } else if (type === "user") {
            if (/^\d+$/.test(user)) {
                query = `SELECT farmer_id AS user_id, farmer_password AS user_password, farmer_session_key FROM farmer WHERE farmer_id = $1`;
            } else {
                query = `SELECT farmer_id AS user_id, farmer_password AS user_password, farmer_session_key FROM farmer WHERE farmer_email = $1`;
            }
        } else {
            return res.status(400).send({ message: "Invalid user type" });
        }

        result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).send({ message: "No user found" });
        }

        const isPasswordValid = (password === result.rows[0].user_password);

        if (isPasswordValid) {
            sessionKey = crypto.randomBytes(16).toString('hex');

            if (type === 'admin') {
                await pool.query(`UPDATE admin SET admin_session_key = $1 WHERE admin_id = $2`, [sessionKey, result.rows[0].user_id]);
            } else if (type === 'user') {
                await pool.query(`UPDATE farmer SET farmer_session_key = $1 WHERE farmer_id = $2`, [sessionKey, result.rows[0].user_id]);
            }

            return res.status(200).send({ message: "Authorized", userId: result.rows[0].user_id, sessionKey: sessionKey });
        } else {
            return res.status(401).send({ message: "Unauthorized" });
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

module.exports = router;