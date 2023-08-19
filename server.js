const cors = require("cors");
const express = require("express");
const app = express();
app.use(cors());
app.use(express.json());
const redis = require('redis');
const mongoose = require('mongoose');
const port = process.env.PORT || 5000;
var CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');

const JWT_SECRET = "YXWUHG34GHVGHXWHJB732VJXW732HWEJ892HHJWEJBHJHJ73H23U";
const AES_SECRET = "FGF432543VSG452BKDHE6621VHHBDQW6HBJWJHB6723GVDE2V72H";

// Redis client setup
const redisClient = redis.createClient({
    password: 'Nib05SsIvA4JTVyMm0JgEB3vhBlPmnl7',
    socket: {
        host: 'redis-18923.c84.us-east-1-2.ec2.cloud.redislabs.com',
        port: 18923
    },
});

const mailjet = require('node-mailjet').apiConnect(
    'b26aea2a6101f6c1756c33fb1ef58c36',
    '9d7c3cfc0cfc6200ff05d7139a0870e6'
);

const DataSchema = new mongoose.Schema({
    profilePic: String,
    name: String,
    email: String,
    password: String,
    phone: String,
    desc: String,
    skills: Array,
    certifications: Array,
    experience: Array(Object),
    education: Array(Object),
    connections: Array,
}, { timestamps: true });

const DataModel = mongoose.models.Data || mongoose.model('Data', DataSchema);

run().catch(err => console.log(err));

async function run() {
    if (!mongoose.connections[0].readyState) {
        await mongoose.connect('mongodb+srv://vercel-admin-user-62fa4c22aff15771cc27d48b:jMEJAAHQy2Zlpfpb@cluster0.ixvzyab.mongodb.net/mobilics', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }
}

app.post('/data', async (req, res) => {
    const { email } = req.body;

    const fetchedData = await DataModel.findOne({ email });
    const fetchedAllData = await DataModel.find();

    if (!fetchedData) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Cache user data and send the response
    res.json({ success: true, data: fetchedData, allData: fetchedAllData });

    // Check if data exists in Redis cache
    // redisClient.get(email, async (err, cachedData) => {
    //     if (err) {
    //         return res.status(500).json({ error: 'Internal Server Error' });
    //     }

    //     if (cachedData !== null) {
    //         // Data found in cache, return cached data
    //         return res.json({ success: true, data: JSON.parse(cachedData) });
    //     } else {
    //         // Data not found in cache, find the user
    //         const fetchedData = await DataModel.findOne({ email });

    //         if (!fetchedData) {
    //             return res.status(404).json({ success: false, message: 'User not found' });
    //         }

    //         // Cache user data and send the response
    //         redisClient.setex(email, 3600, JSON.stringify(fetchedData)); // Cache for 1 hour
    //         res.json({ success: true, fetchedData });
    //     }
    // });

    return;
});

app.put('/update/:id', async (req, res) => {
    const newData = await DataModel.findByIdAndUpdate(req.params.id, req.body.data, { new: true });
    res.status(200).json({ success: true });
    return;
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await DataModel.findOne({ email });

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    const providedHash = CryptoJS.AES.decrypt(user.password, AES_SECRET).toString(CryptoJS.enc.Utf8);
    if (password == providedHash) {
        const token = jwt.sign({ email: email, name: user.name }, JWT_SECRET, { expiresIn: "2d" });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Incorrect password' });
    }
    return;
});

app.post('/signup', async (req, res) => {
    const { email, password, sendOtp } = req.body;
    const user = await DataModel.findOne({ email });
    if (user) {
        res.status(404).json({ success: false, message: 'User already present' });
        return;
    }

    if (!sendOtp) {
        const passwordHash = CryptoJS.AES.encrypt(password, AES_SECRET).toString();
        let data = new DataModel({
            profilePic: "",
            name: req.body.name,
            email: email,
            password: passwordHash,
            phone: "",
            desc: "",
            skills: [],
            certifications: "",
            experience: [],
            education: {},
            connections: []
        })
        await data.save();
        res.json({ success: true, token: jwt.sign({ email: email, name: req.body.name }, JWT_SECRET, { expiresIn: "2d" }) })
    }
    else {
        const request = mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [
                {
                    From: { Email: 'abhirupkumar2003@gmail.com', Name: 'Dashboard Analytics' },
                    To: [{ Email: email }],
                    Subject: 'Welcome to Dashboard Analytics',
                    HTMLPart: `<div>We have sent you this email in response to your request to send the otp on our website.
    
            <br/> Otp for signup --> <a>${req.body.otp}</a>
    
            <br/><br/>
    
            We recommend that you do not share your otp with anyone.If you feel your password has been compromised, you can change it by going to your My Account Page and change your pasword.
    
            </div>`,
                },
            ],
        });

        try {
            await request;
            res.json({ success: true, pin: req.body.otp, message: 'SignUp Verification email sent.' });
        } catch (error) {
            console.error('Error sending email:', error);
            res.status(500).json({ success: false, message: 'An error occurred' });
        }
    }
    return;
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

