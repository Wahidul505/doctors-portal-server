const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;


// middleware 
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nap5w.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// middleware for verify the JWT.If there is nothing on the authHeader it returns 401 status. If the authHeader is truthy and If verified it set the decoded email in request object. If doesn't verified it return 403 status with a message.
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized User' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        client.connect();
        // collection for all the treatments 
        const treatmentCollection = client.db('doctors_portal').collection('treatments');
        // collection for all the bookings of all users 
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        // collection for both all users and admins. Where admins has an extra property => 'role: admin' 
        const userCollection = client.db('doctors_portal').collection('users');

        // endpoint for make an user an admin  
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                return res.send(result);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        });

        // the endpoint is using in useAdmin component in client side for checking if a user is admin 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        // endpoint for inserting a new user and giving the user a verified token and prevent inserting for previous user into database 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });

        // endpoint for getting all the users to display in admin panel 
        app.get('/user', async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        })

        // endpoint for insert a treatment booking into database 
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist });
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        });

        // endpoint for getting all the bookings for a particular user, only if the user has the valid jwt 
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const query = { patient: patient };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        })

        // endpoint for getting the treatments with available slots for a particular date 
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 15, 2022';
            const treatments = await treatmentCollection.find({}).toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            treatments.forEach(treatment => {
                const bookingTreatments = bookings.filter(book => book.treatment === treatment.name);
                const bookedSlots = bookingTreatments.map(book => book.slot);
                const available = treatment.slots.filter(slot => !bookedSlots.includes(slot));
                treatment.slots = available;
            })
            res.send(treatments);
        });


    }
    finally { }
};

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from doctors portal');
})

app.listen(port, () => console.log(`listening to port ${port}`));