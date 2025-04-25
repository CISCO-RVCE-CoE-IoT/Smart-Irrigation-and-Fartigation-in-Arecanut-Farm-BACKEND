const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/moisture/:farm_id', async (req, res) => {
    try {
        let { farm_id } = req.params;
        farm_id = parseInt(farm_id, 10);
        const { farm_key, data } = req.body;
        const valuePlaceholders = [];
        const values = [];

        data.forEach((entry, index) => {
            valuePlaceholders.push(`($${index * 3 + 1}::int, $${index * 3 + 2}::timestamp, $${index * 3 + 3}::int)`);
            values.push(entry.moisture_device_id, entry.timestamp || 'NOW()', entry.value);
        });

        const query = `
        INSERT INTO moisture_data (section_device_id, timestamp, moisture_value)
        SELECT * 
        FROM (VALUES ${valuePlaceholders.join(', ')}) AS v (moisture_device_id, timestamp, moisture_value)
        WHERE v.moisture_device_id IN (
            SELECT section_device_id
            FROM farm_with_all_devices
            WHERE farm_id=$${values.length + 1} AND section_device_name='moisture' AND farm_key =$${values.length + 2}
            )`;

        values.push(farm_id, farm_key);
        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'No valid moisture id or farm key data provided for insertion.' });
        }

        res.status(200).json({ message: 'Moisture data inserted', accepted_rows: result.rowCount, rejected_rows:(data.length-result.rowCount) });
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).json({ message: 'Error inserting data', error: error.message });
    }
});

router.post('/npk/:farm_id', async (req, res) => {
    try {
        let { farm_id } = req.params;
        farm_id = parseInt(farm_id, 10);
        const { farm_key, data } = req.body;
        const valuePlaceholders = [];
        const values = [];

        data.forEach((entry, index) => {
            valuePlaceholders.push(`($${index * 7 + 1}::int, $${index * 7 + 2}::double precision, $${index * 7 + 3}::double precision, $${index * 7 + 4}::double precision, $${index * 7 + 5}::double precision, $${index * 7 + 6}::double precision, $${index * 7 + 7}::timestamp)`);
            values.push(entry.npk_device_id, entry.nitrogen, entry.phosphorus, entry.potassium, entry.temperature, entry.humidity, entry.timestamp || 'NOW()');
        });

        if (valuePlaceholders.length === 0) {
            return res.status(400).json({ message: 'No data provided for insertion.' });
        }

        const query = `
            INSERT INTO field_data (farm_device_id, nitrogen, phosphorus, potassium, temperature, humidity, timestamp)
            SELECT * 
            FROM (VALUES ${valuePlaceholders.join(', ')}) AS v (farm_device_id, nitrogen, phosphorus, potassium, temperature, humidity, timestamp)
            WHERE v.farm_device_id = (
                SELECT farm_device_id
                FROM farm_devices NATURAL JOIN farm 
                WHERE farm_id = $${values.length + 1} and farm_key = $${values.length + 2}
            )`;

        values.push(farm_id, farm_key);
        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'No valid device id or farm key data provided for insertion.' });
        }

        res.status(200).json({ message: 'NPK data inserted', rows: result.rowCount });
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).json({ message: 'Error inserting data', error: error.message });
    }
});

router.get('/valve/:farm_id', async (req, res) => {
    try {
        let { farm_id } = req.params;
        farm_id = parseInt(farm_id, 10);
        const {  farm_key } = req.body;

        const query = `
            SELECT 
                section_device_id,
                valve_mode,
                valve_status,
                valve_timestamp AS timestamp,
                manual_off_timer,
                auto_on_threshold,
                auto_off_threshold,
                ROUND(avg_section_moisture) AS avg_section_moisture
            FROM lst_valve_avg_moisture
            WHERE farm_id = $1
            AND farm_key = $2`;

        const result = await pool.query(query, [farm_id, farm_key]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'No data found for given id or check farm key' });
        }

        res.status(200).json({ message: 'valve data fatched', data: result.rows });

    } catch (error) {
        console.error('Error getting data:', error);
        res.status(500).json({ message: 'Error getting data', error: error.message });
    }
});

router.post('/valve/:valve_id',async (req,res)=>{
    try {
        const { valve_id } = req.params;
        const { mode, status, timer = 0, timestamp = 'NOW()', farm_id, farm_key } = req.body;

        if (!mode || !status || !farm_id || !farm_key) {
            return res.status(400).send({ error: 'Insufficient data' });
        }

        const valveInsertQuery = `
        INSERT INTO valve_data(section_device_id, valve_mode, valve_status, manual_off_timer,timestamp)
            SELECT $1, $2, $3, $4, $5
            WHERE EXISTS (
            SELECT 1
            FROM farm_with_all_devices
            WHERE section_device_name = 'valve'
            AND section_device_id = $1
            AND farm_id = $6
            AND farm_key = $7
            )
            RETURNING valve_mode, valve_status, timestamp;
        `

        const valve_data = await pool.query(valveInsertQuery, [valve_id, mode, status, timer, timestamp, farm_id, farm_key]);

        if (valve_data.rowCount === 0) {
            return res.status(404).send({ error: "No valve found for the provided ID" });
        }

        return res.status(200).send({ message: "inserted value data successfully"});
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while inserting value data" });
    }
});

module.exports = router;