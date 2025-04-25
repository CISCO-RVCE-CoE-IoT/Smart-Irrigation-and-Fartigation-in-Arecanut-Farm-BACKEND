const express = require('express')
const pool = require('./db')
const port = 3000
const cors = require('cors');
const bodyParser = require('body-parser');


const app = express()
app.use(express.json())
app.use(bodyParser.json());

app.use(cors());

// home page api
app.get('/', async (req, res) => {
    try {
        const countRes = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM farmer) AS total_farmers,
                (SELECT COUNT(*) FROM farm) AS total_no_farms,
                (SELECT SUM(farm_size) FROM farm) AS total_land, 
                (SELECT COUNT(*) FROM section_devices) + (SELECT COUNT(*) FROM farm_devices) AS total_devices;
        `);

        res.status(200).send(countRes.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "An error occurred while fetching counts" });
    }
});

// login
const login_route = require('./routes/login');
app.use('/login', login_route);

// admin
const admin_route = require('./routes/admin');
app.use('/admin', admin_route);

// farmer
const farmer_route = require('./routes/farmer');
app.use('/farmer', farmer_route);

// iot
const iot_route = require('./routes/iot');
app.use('/iot', iot_route);

app.listen(port, () => console.log(`server started on port: ${port}`)) 