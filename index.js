const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require('cors')
const port = process.env.PORT || 8000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
  }


app.use(cors(corsOptions))
  
app.use(express.json())






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eaermrq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
      
    //all collection 
    const userCollection = client.db('mediStoreDB').collection('users')

    //jwt related api
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      console.log(user);
      const token =jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'7d'})
      console.log(token);
      res.send({token});
    })



    //users related api
    app.put('/user',async(req,res)=>{
      const user = req.body;
      const query = {email:user?.email}

      const isExist = await userCollection.findOne(query)

      if(isExist){
        return res.send({message:"user already exit", insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //get all users
    app.get('/users',async(req,res)=>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })




























    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from MediStore Server..')
  })
  
app.listen(port, () => {
    console.log(`MediStore is running on port ${port}`)
})