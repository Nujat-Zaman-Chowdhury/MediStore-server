const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eaermrq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    //all collection
    const userCollection = client.db("mediStoreDB").collection("users");
    const medicineCollection = client.db("mediStoreDB").collection("medicines");
    const advertisementCollection = client
      .db("mediStoreDB")
      .collection("advertiments");
    const categoryCollection = client
      .db("mediStoreDB")
      .collection("categories");
    const cartCollection = client.db("mediStoreDB").collection("carts");
    const paymentCollection = client.db("mediStoreDB").collection("payment");

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      console.log(token);
      res.send({ token });
    });

    //middleware
    const verifyToken = (req, res, next) => {
      console.log("Inside Verify token",req.headers.authorization)
      if (!req.headers.authorization) {
        console.log("Authorization header missing");
        return res.status(401).send({ message: "Forbidden access" });
      }
      const token = req.headers.authorization.split(' ')[1];
      console.log("Token received:", token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log("JWT Verification Error:", err);
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        console.log("login",decoded);

        next();
      });
    };

     // use verify admin after verifyToken
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    app.get('/protected-route', verifyToken, (req, res) => {
      res.send(req.decoded); // Temporarily send req.decoded in the response
    });

    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };

      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    //get all users from db for admin
    app.get("/users", async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //get user info by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    //update user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const user = req.body;
      // console.log(user.role);
      const query = { email };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //save medicine in db
    app.post("/medicine", async (req, res) => {
      const medicineData = req.body;
      const result = await medicineCollection.insertOne(medicineData);
      res.send(result);
    });

    //get medicine data for seller
    app.get("/medicines/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const query = { "seller.email": email };

      const result = await medicineCollection.find(query).toArray();

      res.send(result);
    });

    //get all medicines from db
    app.get("/medicines", async (req, res) => {
      const page = parseFloat(req.query.page) - 1;
      const size = parseFloat(req.query.size);
      const search = req.query.search;
      const sort = req.query.sort;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { company: { $regex: search, $options: "i" } },
            { "generic-name": { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { "seller.name": { $regex: search, $options: "i" } },
            { "seller.email": { $regex: search, $options: "i" } },
          ],
        };
      }

      let options = {};
      if (sort) options = { sort: { pricePerUnit: sort === "asc" ? 1 : -1 } };

      const result = await medicineCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/medicines-count", async (req, res) => {
      const search = req.query.search;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { company: { $regex: search, $options: "i" } },
            { "generic-name": { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { "seller.name": { $regex: search, $options: "i" } },
            { "seller.email": { $regex: search, $options: "i" } },
          ],
        };
      }
      const count = await medicineCollection.countDocuments(query);
      // console.log(count);
      res.send({ count });
    });

    //advertisement related api

    app.post("/advertisement", async (req, res) => {
      const advertisementData = req.body;
      const result = await advertisementCollection.insertOne(advertisementData);
      res.send(result);
    });

    //get advertisements details by seller email
    app.get("/advertisements/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { "seller.email": email };
      // console.log(query);
      const result = await advertisementCollection.find(query).toArray();
      res.send(result);
    });

    //get all advertisement for admin
    app.get("/advertisements", async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    });

    //change status

    app.patch("/advertisement/slide/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: status,
      };
      const result = await advertisementCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //save category by admin
    app.post("/category", async (req, res) => {
      const categoryData = req.body;
      const result = await categoryCollection.insertOne(categoryData);
      res.send(result);
    });

    //get categories added by admin
    app.get("/categories", async (req, res) => {
      // const result = await categoryCollection.find().toArray();
      // res.send(result)
      const categories = await categoryCollection.find().toArray();

      const categoriesWithMedicineCount = await Promise.all(
        categories.map(async (category) => ({
          ...category,
          medicineCount: await medicineCollection.countDocuments({
            category: category.category,
          }),
        }))
      );

      res.send(categoriesWithMedicineCount);
    });

    //delete category
    app.delete("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    });

    //update category
    app.put("/category/update/:id", async (req, res) => {
      const id = req.params.id;
      const categoryData = req.body;
      // console.log(categoryData);
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: categoryData,
      };
      const result = await categoryCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //get all category wised medicines
    app.get("/category-details/:category", async (req, res) => {
      const category = req.params.category;
      const page = parseFloat(req.query.page) - 1;
      const size = parseFloat(req.query.size);
      const search = req.query.search;
      const sort = req.query.sort;

      let query = { category: category };
      if (search) {
        query = {
          $and: [
            { category: category },
            {
              $or: [
                { name: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
                { company: { $regex: search, $options: "i" } },
                { pricePerUnit: { $regex: search, $options: "i" } },
              ],
            },
          ],
        };
      }

      let options = {};
      if (sort) options = { sort: { pricePerUnit: sort === "asc" ? 1 : -1 } };
      const result = await medicineCollection
        .find(query,options)
        
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/categories-count/:category", async (req, res) => {
      const search = req.query.search;
      const category = req.params.category;
      let query = { category: category };
      if (search) {
        query = {
          $and: [
            { category: category },
            {
              $or: [
                { name: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
                { company: { $regex: search, $options: "i" } },
                { pricePerUnit: { $regex: search, $options: "i" } },
              ],
            },
          ],
        };
      }

      const count = await medicineCollection.countDocuments(query);
      // console.log(count);
      res.send({ count });
    });

    //shop page related
    //select button

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    //get all carts item
    app.get("/carts", async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result);
    });

    //get use cart item
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { "buyer.email": email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    //update quantity
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;

      const query = {
        _id: new ObjectId(id),
      };
      const updateDoc = {
        $set: { quantity },
      };

      const result = await cartCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //delete item from cart page

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    //delete all items
    app.delete("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { "buyer.email": email };
      const result = await cartCollection.deleteMany(query);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = parseInt(price * 100);
      console.log("amount inside", amount);
      console.log("Price", price);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment posst
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      // console.log(payment);
      const paymentResult = await paymentCollection.insertOne(paymentInfo);

      const query = {
        _id: {
          $in: paymentInfo.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      // console.log(query);
      res.send({ paymentResult, deleteResult });
    });

    //get all payments for admin
    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    //  update payment status
    app.patch("/payment/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      console.log(id, status);
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status },
      };
      const result = await paymentCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //  //get payment history for user
    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    //  get payment history for seller
    app.get("/payments/sellers/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "items.seller.email": email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    //for invoice page
    app.get("/payment/invoice/:transactionId", async (req, res) => {
      const transactionId = req.params.transactionId;
      const query = { transactionId: transactionId };
      const result = await paymentCollection.findOne(query);
      res.send(result);
    });

    // app.get('/payments/sellers', async (req, res) => {

    //   const result = await paymentCollection.aggregate([
    //     {
    //       $unwind: '$items'
    //     },
    //   ]).toArray()
    //   res.send(result)
    // });

    //get seller email data
    app.get("/payments/sellers/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "items.seller.email": email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });


    //revenue 
    //admin
    app.get('/admin-revenue',async(req,res)=>{
      const salesDetails = await paymentCollection
      .find(

        {},
        
      ).toArray();
      let totalPaid = 0;
      let totalPending = 0;
      countPaid=0;
      countPending =0;

      for(sale of salesDetails){
        if(sale.status === 'paid'){
          totalPaid += sale.price;
          countPaid++;
        }else if(sale.status === 'pending'){
          totalPending += sale.price;
          countPending++;
        }
      }

      res.send({totalPaid,totalPending,countPaid,countPending})

    })
    
    //seller
    // app.get('/seller-revenue',async(req,res)=>{
    //   const email = req.decoded.user
    //   console.log(email);
    //   const salesDetails = await paymentCollection
    //   .find(

    //     {"items.seller.email":email},
        
    //   ).toArray();
    //   let totalPaid = 0;
    //   let totalPending = 0;
    //   countPaid=0;
    //   countPending =0;

    //   for (const sale of salesDetails) {
    //     for (const item of sale.items) {
    //         if (item.seller.email === email) {
    //             if (sale.status === 'paid') {
    //                 totalPaid += item.pricePerUnit * item.quantity * (1 - item.discountPercentage / 100);
    //                 countPaid++;
    //             } else if (sale.status === 'pending') {
    //                 totalPending += item.pricePerUnit * item.quantity * (1 - item.discountPercentage / 100);
    //                 countPending++;
    //             }
    //         }
    //     }
    // }

    

    //   res.send({totalPaid,totalPending,countPaid,countPending})

    // })

    app.get('/seller-revenue/:email', async (req, res) => {
      const email = req.params.email;
      const result = await paymentCollection.aggregate([
          { $unwind: '$items' },
          { $match: { 'items.seller.email': email } },
          { $group: {
              _id: '$status',
              totalAmount: { $sum: '$items.pricePerUnit' },
              count: { $sum: 1 }
          } }
      ]).toArray();
  
      const revenue = {
          paidTotal: result.find(r => r._id === 'paid')?.totalAmount || 0,
          pendingTotal: result.find(r => r._id === 'pending')?.totalAmount || 0,
          paidCount: result.find(r => r._id === 'paid')?.count || 0,
          pendingCount: result.find(r => r._id === 'pending')?.count || 0
      };
  
      res.send(revenue);
  });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from MediStore Server..");
});

app.listen(port, () => {
  console.log(`MediStore is running on port ${port}`);
});
