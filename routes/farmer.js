const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:farmer_id', async (req, res) => {
    try {
        const { farmer_id } = req.params;

        const farmer_details = await pool.query(`
            SELECT 
                farmer_id, 
                farmer_fname,
                (SELECT COUNT(*) FROM farm WHERE farmer_id = farmer.farmer_id) AS farmer_total_farms
            FROM farmer 
            WHERE farmer_id = $1;`, [farmer_id]);

        if (farmer_details.rowCount === 0) {
            return res.status(404).send({ error: "Farmer not found" });
        }

        const all_farms = await pool.query(`
            SELECT 
                farm_id, 
                farm_name, 
                farm_size, 
                farm_location_cordinates[1] AS farm_location 
            FROM farm 
            WHERE farmer_id = $1
            ORDER BY farm_id`, [farmer_id]);

        if (all_farms.rowCount === 0) {
            return res.status(404).send({ error: "No Farm found for the provided ID" });
        }

        // const a_farm_id = all_farms.rows[0].farm_id;

        // const a_farm_details = await farm_details(a_farm_id);
        // const a_farm_locations = await farm_locations(a_farm_id);
        // const all_devices = await all_section_devices(a_farm_id);
        // const all_sensor_values_data = await all_sensor_values(a_farm_id);

        res.status(200).send({
            farmer_details: farmer_details.rows[0],
            farmer_farms: all_farms.rows,
            // farm_details: a_farm_details,
            // location_coordinates: {
            //     farm_coordinates: a_farm_locations.farm_location_cordinates,
            //     farm_device: all_devices.farm_devices,
            //     section_device: all_devices.section_devices
            // },
            // device_values: all_sensor_values_data
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching farmer details" });
    }
});

router.get('/farm/valve/:valve_id', async (req, res) => {
    try {
        const { valve_id } = req.params;
        const valve_data = await pool.query(
            "SELECT section_device_id, valve_mode, valve_status, timestamp, manual_off_timer FROM valve_data WHERE section_device_id = $1 ORDER BY valve_data_id DESC LIMIT 10",
            [valve_id]
        );

        if (valve_data.rows.length === 0) {
            return res.status(404).send({ error: "No valve data found for the provided ID" });
        }

        res.status(200).send(valve_data.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching valve data" });
    }
});

router.get('/farm/moisture/:sensor_id', async (req, res) => {
    try {
        const { sensor_id } = req.params;
        const moisture_data = await pool.query(
            "SELECT section_device_id, timestamp, moisture_value FROM moisture_data WHERE section_device_id =$1 ORDER BY moisture_data_id DESC limit 10;",
            [sensor_id]
        );

        if (moisture_data.rows.length === 0) {
            return res.status(404).send({ error: "No moisture data found for the provided sensor ID" });
        }

        res.status(200).send(moisture_data.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching moisture data" });
    }
});

router.get('/farm/farm_device/:farm_device_id', async (req, res) => {
    try {
        const { farm_device_id } = req.params;
        const field_data = await pool.query(
            "SELECT nitrogen, phosphorus, potassium, temperature, humidity, timestamp FROM field_data  WHERE farm_device_id = $1 ORDER BY field_data_id DESC limit 10;",
            [farm_device_id]
        );

        if (field_data.rows.length === 0) {
            return res.status(404).send({ error: "No form data found for the provided field ID" });
        }

        res.status(200).send(field_data.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching field data" });
    }
});

router.get('/farm/:farm_id', async (req, res) => {
    try {
        const { farm_id } = req.params;

        const farm_loc = await farm_locations(farm_id);

        if (farm_loc.rowCount === 0) {
            return res.status(404).send({ error: "No Farm found for the provided ID" });
        }

        const farm_detail = await farm_details(farm_id);
        const all_devices = await all_section_devices(farm_id);
        const all_sensor_values_data = await all_sensor_values(farm_id);

        res.status(200).send({
            farm_details: farm_detail,
            location_coordinates: {
                farm_coordinates: farm_loc.farm_location_cordinates,
                farm_device: all_devices.farm_devices,
                section_device: all_devices.section_devices
            },
            device_values: all_sensor_values_data
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching farmer details" });
    }
});

router.put('/farm/farm_name/:farm_id', async (req, res) => {
    try {
        const { farm_id } = req.params;
        const { farmer_id, farm_name } = req.body;

        if (!farmer_id, !farm_name) {
            return res.status(400).send({ error: "All fields are required" });
        }

        const farm_name_update_query = 'UPDATE farm SET farm_name=$1 WHERE farm_id=$2 AND farmer_id=$3 RETURNING farm_id, farm_name'

        const farm_updated_name = await pool.query(farm_name_update_query, [farm_name, farm_id, farmer_id]);

        if (farm_updated_name.rowCount === 0) {
            return res.status(404).send({ error: "No Farm found for the provided ID for this farmer" });
        }

        return res.status(200).send({ message: "Farm name updated successfully", farm_updated_name: farm_updated_name.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while updating the farm name" });
    }



});

router.put('/farm/auto_threshold/:farm_id', async (req, res) => {
    try {
        const { farm_id } = req.params;
        const { auto_on_threshold, auto_off_threshold, farmer_id } = req.body;

        if (!auto_on_threshold || !auto_off_threshold || !farm_id) {
            return res.status(400).send({ error: "All fields are required" });
        }

        if (typeof auto_on_threshold !== 'number' || typeof auto_off_threshold !== 'number' || 100 >= auto_on_threshold <= 0 || 100 >= auto_off_threshold <= 0) {
            return res.status(400).send({ error: "Invalid threshold values" });
        }

        const auto_threshold_update_query = 'UPDATE farm SET auto_on_threshold=$1, auto_off_threshold=$2 WHERE farm_id=$3 AND farmer_id=$4 RETURNING auto_on_threshold, auto_off_threshold';

        const auto_threshold_update = await pool.query(auto_threshold_update_query, [auto_on_threshold, auto_off_threshold, farm_id, farmer_id]);

        if (auto_threshold_update.rowCount === 0) {
            return res.status(404).send({ error: "No Farm found for the provided ID for this farmer" });
        }

        return res.status(200).send({ message: "Auto threshold updated successfully", auto_threshold_update: auto_threshold_update.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while updating auto_threshold values" });
    }
});

router.post('/farm/valve/:valve_id', async (req, res) => {
    try {
        const { valve_id } = req.params;
        const { mode, status, timer = 0, farmer_id } = req.body;

        if (!mode || !status || !farmer_id) {
            return res.status(400).send({ error: 'Insufficient data' });
        }

        const valveInsertQuery = `
        INSERT INTO valve_data(section_device_id, valve_mode, valve_status, manual_off_timer)
            SELECT $1, $2, $3, $4
            WHERE EXISTS (
            SELECT 1
            FROM all_valve_data
            WHERE section_device_id = $1 AND farmer_id = $5
            )
            RETURNING valve_mode, valve_status, timestamp;
        `

        const valve_data = await pool.query(valveInsertQuery, [valve_id, mode, status, timer, farmer_id]);

        if (valve_data.rowCount === 0) {
            return res.status(404).send({ error: "No valve found for the provided ID" });
        }

        return res.status(200).send({ message: "inserted value data successfully", valve_data: valve_data.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while inserting value data" });
    }

});

router.post('/farm/all_valve/:farm_id', async (req, res) => {
    try {
        const { farm_id } = req.params;
        const { mode, status, farmer_id, timer = 0 } = req.body;

        // Validate received data
        if (!mode || !farmer_id) {
            return res.status(400).send({ error: 'Insufficient data' });
        }

        let insertData = [];

        // Query to fetch valve data for the farm
        const valveSelectQuery = `
            SELECT section_device_id, valve_mode, valve_status, auto_on_threshold, avg_section_moisture
            FROM public.lst_valve_avg_moisture
            WHERE farm_id = $1;
        `;

        const valveData = await pool.query(valveSelectQuery, [farm_id]);

        if (valveData.rowCount === 0) {
            return res.status(404).send({ error: "No valve data found for the provided farm ID" });
        }

        // Loop through each valve data and compare with received mode and status
        for (let valve of valveData.rows) {
            const { section_device_id, valve_mode, valve_status, auto_on_threshold, avg_section_moisture } = valve;

            let finalStatus = status;  // Default to the received status

            if (mode === "auto") {
                // For auto mode, decide the status based on avg_section_moisture
                finalStatus = avg_section_moisture < auto_on_threshold ? "on" : "off";
            }

            // Only insert if there is a change in mode or status
            if (valve_mode !== mode || valve_status !== finalStatus) {
                insertData.push([section_device_id, mode, finalStatus, timer]);
            }
        }

        // Insert accumulated data all at once if any data is collected
        if (insertData.length > 0) {
            const valueStrings = insertData.map(
                data => `('${data[0]}', '${data[1]}', '${data[2]}', ${data[3]})`
            ).join(', ');

            const valveInsertQuery = `
                INSERT INTO valve_data (section_device_id, valve_mode, valve_status, manual_off_timer)
                VALUES ${valueStrings}
                RETURNING valve_mode, valve_status, timestamp;
            `;

            await pool.query(valveInsertQuery);
        }

        // Success response
        return res.status(200).send({ message: "Valve data processed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while processing valve data" });
    }
});


async function farm_locations(farm_id) {
    const result = await pool.query(
        'SELECT farm_location_cordinates FROM farm WHERE farm_id = $1',
        [farm_id]
    );
    return result.rows[0];
}

async function farm_details(farm_id) {
    const result = await pool.query(
        'SELECT farm_id, farm_name, auto_on_threshold, auto_off_threshold FROM farm WHERE farm_id = $1', [farm_id]
    );
    return result.rows[0];
}

async function all_section_devices(farm_id) {

    const [section_devices, farm_devices] = await Promise.all([
        pool.query(
            `SELECT 
                sd.section_device_id, 
                sd.section_id, 
                s.section_name, 
                sd.device_name, 
                sd.device_location 
            FROM section_devices sd 
            JOIN section s ON sd.section_id = s.section_id 
            WHERE farm_id = $1`, [farm_id]
        ),
        pool.query(
            `SELECT 
                farm_device_id, 
                device_name, 
                device_location 
            FROM farm_devices 
            WHERE farm_id = $1`, [farm_id]
        )
    ]);

    return { section_devices: section_devices.rows, farm_devices: farm_devices.rows }
}

async function all_sensor_values(farm_id) {

    const [moisture_devices_data, valve_devices_data, farm_device_data] = await Promise.all([
        pool.query(`
        SELECT DISTINCT ON (md.section_device_id) 
            md.section_device_id, 
            md.timestamp, 
            md.moisture_value, 
            md.section_id
        FROM public.all_moisture_data md
        WHERE md.farm_id = $1
        ORDER BY md.section_device_id, md.moisture_data_id DESC`, [farm_id]
        ),
        pool.query(`
        SELECT
            section_id,
            section_name,
            section_device_id,
            valve_mode,
            valve_status,
            valve_timestamp,
            manual_off_timer,
            avg_section_moisture
        FROM
            lst_valve_avg_moisture
        WHERE
            farm_id = $1`, [farm_id]
        ),
        pool.query(`
        SELECT 
            farm_device_id,
            nitrogen,
            phosphorus,
            potassium,
            temperature,
            humidity,
            timestamp,
            avg_moisture
        FROM 
            lst_field_data
        WHERE 
            farm_id = $1`, [farm_id]
        )
    ])
    return {
        moisture_device_value: moisture_devices_data.rows,
        valve_devices_data: valve_devices_data.rows,
        farm_device_data: farm_device_data.rows,
    }

}

module.exports = router;