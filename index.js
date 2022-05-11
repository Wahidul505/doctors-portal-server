const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


// middleware 
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nap5w.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        client.connect();
        const treatmentCollection = client.db('doctors_portal').collection('treatments');
        const bookingTreatmentCollection = client.db('doctors_portal').collection('bookingTreatments');

        app.get('/treatment', async (req, res) => {
            const query = {};
            const cursor = treatmentCollection.find(query);
            const treatments = await cursor.toArray();
            res.send(treatments);
        });

        app.post('/bookingTreatment', async (req, res) => {
            const bookingInfo = req.body;
            const result = await bookingTreatmentCollection.insertOne(bookingInfo);
            res.send({ success: true });
        })
    }
    finally { }
};

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from doctors portal');
})

app.listen(port, () => console.log(`listening to port ${port}`));