const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const medicineCollection = client.db('mediStoreDB').collection('medicines')
    const advertisementCollection = client.db('mediStoreDB').collection('advertiments')
    const categoryCollection = client.db('mediStoreDB').collection('categories')

    //jwt related api
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      // console.log(user);
      const token =jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'7d'})
      // console.log(token);
      res.send({token});
    })

    //middleware
    const verifyToken = (req,res,next)=>{
      // console.log("Inside Verify token",req.headers)
      if(!req.headers.authorization){
        return res.status(401).send({message: 'Forbidden access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded= decoded;
        next();
      })
    }



    //users related api
    // app.put('/user',async(req,res)=>{
    //   const user = req.body;
    //   const query = {email:user?.email}
      
    //   const isExist = await userCollection.findOne(query)

    //   if(isExist){
    //     return res.send({message:"user already exit", insertedId: null})
    //   }
    //   const result = await userCollection.insertOne(user);
    //   res.send(result)
    // })

    // save user data in db 
    app.put('/user',async(req,res)=>{
      const user = req.body;
      const query = {email: user?.email}
      const isExist =await userCollection.findOne(query)
      if(isExist){
        return res.send(isExist)
      }

      const options = {upsert: true}
      

      const updateDoc = {
        $set:
        {
          ...user,
          timestamp:Date.now()
        }
      }

      const result = await userCollection.updateOne(query,updateDoc,options)
      res.send(result)
      })

    //get all users from db for admin
    app.get('/users',async(req,res)=>{
      // console.log(req.headers);
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    //get user info by email
    app.get('/user/:email',async(req,res)=>{
      const email = req.params.email
      const result = await userCollection.findOne({email})
      res.send(result)
    })

    //update user role
    app.patch('/users/update/:email',async(req,res)=>{
      const email = req.params.email
      // console.log(email);
      const user = req.body;
      // console.log(user.role);
      const query = {email}
      const updateDoc={
        $set:{
          ...user,timestamp:Date.now(),
        }
        
      }
      const result = await userCollection.updateOne(query,updateDoc)
      res.send(result)
    })










    //save medicine in db
    app.post('/medicine',async(req,res)=>{
      const medicineData = req.body;
      const result = await medicineCollection.insertOne(medicineData)
      res.send(result)
    })

    //get medicine data for seller
    app.get('/medicines/:email',verifyToken,async(req,res)=>{
      const email = req.params.email;
      
      const query = {'seller.email':email}
      
      const result = await medicineCollection.find(query).toArray()
     
      res.send(result)
    })
    //get all medicines from db
    app.get('/medicines',async(req,res)=>{
      const result = await medicineCollection.find().toArray();
      res.send(result);
    })





    //advertisement related api

    app.post('/advertisement',async(req,res)=>{
      const advertisementData = req.body;
      const result = await advertisementCollection.insertOne(advertisementData)
      res.send(result)
    })


    //get advertisements details by seller email 
    app.get('/advertisements/:email',async(req,res)=>{
      const email = req.params.email;
      // console.log(email);
      const query = {'seller.email':email}
      // console.log(query);
      const result = await advertisementCollection.find(query).toArray()
       res.send(result)
    })

    //get all advertisement for admin
    app.get('/advertisements',async(req,res)=>{
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    })

    //change status

    app.patch('/advertisement/slide/:id',async(req,res)=>{
      const id = req.params.id;
      const status = req.body
      const query = {_id: new ObjectId(id)}
      const updateDoc={
        $set:
          status,
      }
      const result = await advertisementCollection.updateOne(query,updateDoc)
      res.send(result);
    })


    //save category by admin
    app.post('/category',async(req,res)=>{
      const categoryData = req.body;
      const result = await categoryCollection.insertOne(categoryData)
      res.send(result)
    })

    //get categories added by admin
    app.get('/categories',async(req,res)=>{
      const result = await categoryCollection.find().toArray();
      res.send(result)
    })
    
    //delete category
    app.delete('/category/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await categoryCollection.deleteOne(query)
      res.send(result)
    })

    //update category
    app.put('/category/update/:id',async(req,res)=>{
      const id = req.params.id;
      const categoryData = req.body;
      // console.log(categoryData);
      const query = {_id: new ObjectId(id)}
      const updateDoc= {
        $set:categoryData,
        
      }
      const result = await categoryCollection.updateOne(query,updateDoc)
      res.send(result)
    })


    //get all category wised medicines
    app.get('/category-details/:category',async(req,res)=>{
      const category = req.params.category;
      const result = await medicineCollection.find({category}).toArray();
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