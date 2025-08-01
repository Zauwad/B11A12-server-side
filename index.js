const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB client
const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: ServerApiVersion.v1,
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function run() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");

        // Database & Collections
        const db = client.db("fitnessDB");
        const usersCollection = db.collection("users");

        // 🔹 Get All Users
        app.get("/users", async (req, res) => {
            try {
                const users = await usersCollection.find().toArray();
                res.json(users);
            } catch (err) {
                res.status(500).json({ error: "Failed to get users", details: err });
            }
        });


        // 🔹 Register/Save User (for Firebase Registration)
        app.post("/users", async (req, res) => {
            try {
                const user = req.body;

                if (!user.email) {
                    return res.status(400).json({ error: "Email is required" });
                }

                // Check if user exists
                const existingUser = await usersCollection.findOne({ email: user.email });

                if (existingUser) {
                    // ✅ If user exists but has no role, update it
                    if (!existingUser.role) {
                        await usersCollection.updateOne(
                            { email: user.email },
                            { $set: { role: "member" } }
                        );
                        existingUser.role = "member";
                    }
                    return res.status(200).json({ message: "User already exists", user: existingUser });
                }

                // ✅ New user → assign default role
                user.role = "member";
                const result = await usersCollection.insertOne(user);

                res.status(201).json({ message: "User registered successfully", insertedId: result.insertedId });

            } catch (err) {
                res.status(500).json({ error: "Failed to save user", details: err });
            }
        });



        // TESTIMONIALS
        // Inside your run() function, after connecting to MongoDB
        const testimonialsCollection = db.collection("testimonials");

        // 🔹 1. POST - Add a new testimonial
        app.post("/testimonials", async (req, res) => {
            try {
                const testimonial = req.body; // expects { name, review, role }

                if (!testimonial.name || !testimonial.review) {
                    return res.status(400).json({ error: "Name and review are required" });
                }

                testimonial.createdAt = new Date();

                const result = await testimonialsCollection.insertOne(testimonial);
                res.status(201).json({ message: "Testimonial added successfully", id: result.insertedId });
            } catch (err) {
                res.status(500).json({ error: "Failed to add testimonial", details: err });
            }
        });

        // 🔹 2. GET - Fetch all testimonials
        app.get("/testimonials", async (req, res) => {
            try {
                const testimonials = await testimonialsCollection
                    .find()
                    .sort({ createdAt: -1 }) // newest first
                    .toArray();

                res.json(testimonials);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch testimonials", details: err });
            }
        });


        //CLASSES
        // Classes Collection
        const classesCollection = db.collection("classes");

        //admin will do the post
        // 🔹 API to Add New Class (Admin only ideally)
        app.post("/classes", async (req, res) => {
            try {
                const newClass = req.body; // expects { name, image, details, ... }

                if (!newClass.name || !newClass.image || !newClass.details) {
                    return res.status(400).json({ error: "Class name, image, and details are required" });
                }

                // Add createdAt timestamp
                newClass.createdAt = new Date();
                newClass.totalBookings = 0; // default 0 bookings at the start

                const result = await classesCollection.insertOne(newClass);
                res.status(201).json({ message: "Class added successfully", insertedId: result.insertedId });
            } catch (err) {
                res.status(500).json({ error: "Failed to add class", details: err });
            }
        });

        // ✅ API to Get All Classes with Pagination & Search
        app.get("/classes", async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 6;
                const skip = (page - 1) * limit;
                const search = req.query.search || ""; // 🔹 Get search keyword from query

                const query = search
                    ? { name: { $regex: search, $options: "i" } } // 🔹 Case-insensitive search
                    : {};

                const totalClasses = await classesCollection.countDocuments(query);

                const classes = await classesCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.json({
                    data: classes,
                    currentPage: page,
                    totalPages: Math.ceil(totalClasses / limit),
                    totalClasses,
                });
            } catch (err) {
                console.error("❌ Error fetching classes:", err);
                res.status(500).json({ error: "Failed to fetch classes", details: err.message });
            }
        });


        // top six for feautured section
        // 📌 Get Top 6 Most Booked Classes// ✅ API to Get All Classes with Pagination


        app.get("/classes/featured", async (req, res) => {
            try {
                const featuredClasses = await classesCollection
                    .find()
                    .sort({ totalBookings: -1 }) // sort by bookings (highest first)
                    .limit(6) // take only top 6
                    .toArray();

                res.json(featuredClasses);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch featured classes", details: err });
            }
        });




        // Add New Trainer
        const trainersCollection = db.collection('trainers')
        app.post("/trainers", async (req, res) => {
            try {
                const trainer = req.body;
                if (!trainer.name || !trainer.image || !trainer.experience) {
                    return res.status(400).json({ error: "Name, image, and experience are required" });
                }

                trainer.createdAt = new Date(); // Timestamp

                const result = await trainersCollection.insertOne(trainer);
                res.status(201).json({ message: "Trainer added successfully", insertedId: result.insertedId });
            } catch (err) {
                res.status(500).json({ error: "Failed to add trainer", details: err });
            }
        });

        // Get All Trainers
        app.get("/trainers", async (req, res) => {
            try {
                const trainers = await trainersCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(trainers);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch trainers", details: err });
            }
        });

        // Get Trainer by ID
        app.get("/trainers/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const trainer = await trainersCollection.findOne({ _id: new ObjectId(id) });

                if (!trainer) {
                    return res.status(404).json({ error: "Trainer not found" });
                }

                res.json(trainer);
            } catch (err) {
                console.error("❌ Failed to fetch trainer:", err);
                res.status(500).json({ error: "Failed to fetch trainer", details: err.message });
            }
        });



        // Get forum posts with pagination
        const forumCollection = db.collection('forum')
        app.get("/forum", async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = 6;
                const skip = (page - 1) * limit;

                const totalPosts = await forumCollection.countDocuments();
                const posts = await forumCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.json({
                    posts,
                    totalPages: Math.ceil(totalPosts / limit),
                    currentPage: page,
                });
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch forum posts", details: err });
            }
        });

        // Upvote / Downvote
        app.patch("/forum/:id/vote", async (req, res) => {
            try {
                const { userId, voteType } = req.body; // voteType: 'up' or 'down'
                const postId = req.params.id;

                // Basic logic: increment or decrement
                const updateField = voteType === "up" ? { $inc: { upvotes: 1 } } : { $inc: { downvotes: 1 } };

                await forumCollection.updateOne({ _id: new ObjectId(postId) }, updateField);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: "Failed to update vote", details: err });
            }
        });


        // POST Apply Trainer
        app.post("/trainers/apply", async (req, res) => {
            try {
                const trainer = req.body;

                // ✅ Save all fields including availableDays and expertise
                const newTrainer = {
                    name: trainer.name,
                    email: trainer.email,
                    age: Number(trainer.age),
                    image: trainer.image,
                    experience: Number(trainer.experience),
                    details: trainer.details || "",
                    expertise: Array.isArray(trainer.expertise) ? trainer.expertise : [],
                    availableDays: Array.isArray(trainer.availableDays) ? trainer.availableDays : [],
                    availableSlots: Array.isArray(trainer.availableSlots) ? trainer.availableSlots : [],
                    socials: trainer.socials || { facebook: "", instagram: "", linkedin: "" },
                    status: trainer.status || "pending",
                    createdAt: new Date(),
                };

                const result = await trainersCollection.insertOne(newTrainer);
                res.json({ success: true, insertedId: result.insertedId });
            } catch (err) {
                console.error("❌ Failed to apply trainer:", err);
                res.status(500).json({ error: "Failed to submit application" });
            }
        });


        // 🟢 Get Trainer Applications by User Email
        app.get("/trainers/applications", async (req, res) => {
            try {
                const email = req.query.email;
                if (!email) return res.status(400).json({ error: "Email is required" });

                const applications = await trainersCollection
                    .find({ email }) // ✅ Get only this user's applications
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(applications);
            } catch (err) {
                console.error("❌ Failed to fetch applications:", err);
                res.status(500).json({ error: "Failed to fetch applications", details: err.message });
            }
        });

        // ✅ Get all pending trainer applications
        app.get("/trainers/applications/pending", async (req, res) => {
            try {
                const pendingApps = await trainersCollection.find({ status: "pending" }).toArray();
                res.json(pendingApps);
            } catch (err) {
                console.error("❌ Error fetching pending trainers:", err);
                res.status(500).json({ error: "Failed to fetch pending trainer applications" });
            }
        });

        // speccific trainer applied
        app.get("/trainers/applications/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const applicant = await trainersCollection.findOne({ _id: new ObjectId(id), status: "pending" });

                if (!applicant) return res.status(404).json({ error: "Applicant not found" });
                res.json(applicant);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch applicant details" });
            }
        });


        //aprroving
        app.patch("/trainers/applications/:id/confirm", async (req, res) => {
            try {
                const { id } = req.params;
                const applicant = await trainersCollection.findOne({ _id: new ObjectId(id) });
                if (!applicant) return res.status(404).json({ error: "Applicant not found" });

                // ✅ Insert into trainers collection
                await db.collection("trainers").insertOne({
                    name: applicant.name,
                    email: applicant.email,
                    age: applicant.age,
                    image: applicant.image,
                    experience: applicant.experience,
                    details: applicant.details,
                    expertise: applicant.expertise || [],
                    availableDays: applicant.availableDays || [],
                    availableSlots: applicant.availableSlots || [],
                    socials: applicant.socials || {},
                    status: "approved",
                    createdAt: new Date()
                });

                // ✅ Remove from applications
                await trainersCollection.deleteOne({ _id: new ObjectId(id) });

                res.json({ success: true, message: "Trainer approved and added" });
            } catch (err) {
                res.status(500).json({ error: "Failed to confirm trainer" });
            }
        });


        // rejecting
        app.patch("/trainers/applications/:id/reject", async (req, res) => {
            try {
                const { id } = req.params;
                const { feedback } = req.body;

                const result = await trainersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: "rejected", feedback: feedback || "No feedback provided" } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ error: "Applicant not found or already rejected" });
                }

                res.json({ success: true, message: "Application rejected with feedback" });
            } catch (err) {
                res.status(500).json({ error: "Failed to reject trainer" });
            }
        });


        // 🟢 Newsletter Subscription Endpoint
        const subscribersCollection = db.collection('subscriber')
        app.post("/newsletter/subscribe", async (req, res) => {
            try {
                const { name, email } = req.body;

                if (!name || !email) {
                    return res.status(400).json({ error: "Name and email are required" });
                }

                // ✅ Check if already subscribed
                const existing = await subscribersCollection.findOne({ email });
                if (existing) {
                    return res.status(409).json({ error: "You are already subscribed" });
                }

                // ✅ Insert new subscriber
                const subscriber = { name, email, createdAt: new Date() };
                await subscribersCollection.insertOne(subscriber);

                res.json({ success: true, message: "Subscription successful" });
            } catch (err) {
                console.error("❌ Failed to save subscriber:", err);
                res.status(500).json({ error: "Failed to subscribe", details: err.message });
            }
        });



        // Get all newsletter subscribers
        app.get("/newsletter/subscribers", async (req, res) => {
            try {
                const subscribers = await subscribersCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(subscribers);
            } catch (err) {
                console.error("❌ Failed to fetch subscribers:", err);
                res.status(500).json({ error: "Failed to fetch subscribers", details: err.message });
            }
        });


        // Express example
        const { ObjectId } = require("mongodb");

        app.patch("/trainers/:id/remove-trainer", async (req, res) => {
            try {
                const trainerId = req.params.id;

                // ✅ 1. Find trainer from trainers collection
                const trainer = await trainersCollection.findOne({ _id: new ObjectId(trainerId) });
                if (!trainer) {
                    return res.status(404).json({ message: "Trainer not found" });
                }

                // ✅ 2. Insert trainer data into users collection as a normal user
                const userDoc = {
                    name: trainer.name,
                    email: trainer.email,
                    image: trainer.image || "",
                    role: "member",
                    createdAt: new Date()
                };

                await usersCollection.insertOne(userDoc);

                // ✅ 3. Remove trainer from trainers collection
                await trainersCollection.deleteOne({ _id: new ObjectId(trainerId) });

                res.json({ success: true, message: "Trainer removed and converted to member successfully" });

            } catch (error) {
                console.error("❌ Error removing trainer:", error);
                res.status(500).json({ error: "Failed to remove trainer" });
            }
        });




        const bookingsCollection = db.collection("bookings");
        // 🟢 Create Booking & Save Payment Info
        app.post("/payments", async (req, res) => {
            try {
                const payment = req.body;

                if (!payment.userEmail || !payment.trainerId) {
                    return res.status(400).json({ error: "Invalid booking data" });
                }

                // ✅ Save booking/payment in bookings collection
                const result = await bookingsCollection.insertOne({
                    ...payment,
                    status: "success",  // for now assume all payments succeed
                    createdAt: new Date()
                });

                res.status(201).json({ message: "Payment & booking saved successfully", id: result.insertedId });
            } catch (err) {
                console.error("❌ Failed to save payment:", err);
                res.status(500).json({ error: "Failed to save booking/payment" });
            }
        });


        app.get("/trainers/by-email/:email", async (req, res) => {
            const trainer = await db.collection("trainers").findOne({ email: req.params.email });
            res.json(trainer);
        });


        app.get("/bookings/trainer/:trainerId", async (req, res) => {
            const bookings = await db.collection("bookings").find({ trainerId: req.params.trainerId }).toArray();
            res.json(bookings);
        });



        app.delete("/trainers/:trainerId/slots", async (req, res) => {
            const { slot } = req.body;
            await db.collection("trainers").updateOne(
                { _id: new ObjectId(req.params.trainerId) },
                { $pull: { availableSlots: slot } }
            );
            res.json({ success: true });
        });


        // GET trainer by email
        //manage slots
        // GET trainer by email
        app.get("/trainers/email/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const trainer = await db.collection("trainers").findOne({ email });
                if (!trainer) return res.status(404).json({ error: "Trainer not found" });
                res.json(trainer);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch trainer" });
            }
        });


        // PATCH remove slot
        app.patch("/trainers/:id/remove-slot", async (req, res) => {
            try {
                const { id } = req.params;
                const { slotIndex } = req.body;

                const trainer = await db.collection("trainers").findOne({ _id: new ObjectId(id) });
                if (!trainer) return res.status(404).json({ error: "Trainer not found" });

                trainer.availableSlots.splice(slotIndex, 1);

                await db.collection("trainers").updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { availableSlots: trainer.availableSlots } }
                );

                res.json({ success: true, message: "Slot removed successfully" });
            } catch (err) {
                res.status(500).json({ error: "Failed to remove slot" });
            }
        });



        // 🟢 Add New Slot to Trainer
        // 🟢 Add Slot to Trainer
        app.patch("/trainers/:id/add-slot", async (req, res) => {
            try {
                const { id } = req.params;
                const newSlot = req.body;

                const result = await trainersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { availableSlots: newSlot } }
                );

                if (result.modifiedCount === 0) return res.status(404).json({ error: "Trainer not found" });

                res.json({ success: true, message: "Slot added successfully" });
            } catch (err) {
                console.error("❌ Failed to add slot:", err);
                res.status(500).json({ error: "Failed to add slot" });
            }
        });

        // ✅ Add new slot to trainer
        app.post("/trainers/:id/slots", async (req, res) => {
            try {
                const { id } = req.params;
                const newSlot = req.body;

                await trainersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { availableSlots: newSlot } }
                );

                res.json({ success: true, message: "New slot added successfully" });
            } catch (err) {
                res.status(500).json({ error: "Failed to add slot" });
            }
        });




        // POST new forum post
        app.post("/forum", async (req, res) => {
            try {
                const post = req.body;
                await db.collection("forum").insertOne(post);
                res.json({ success: true, message: "Forum post added!" });
            } catch (err) {
                res.status(500).json({ error: "Failed to add forum post" });
            }
        });



        // GET trainer applications (pending/rejected only)
        // ✅ NEW API: Get all pending or rejected trainer applications (admin view)
        app.get("/trainers/applications/status/filter", async (req, res) => {
            try {
                const applications = await db.collection("trainers").find(
                    { status: { $in: ["pending", "rejected"] } }
                ).sort({ createdAt: -1 }).toArray();

                res.json(applications);
            } catch (err) {
                console.error("❌ Failed to fetch filtered applications:", err);
                res.status(500).json({ error: "Failed to fetch filtered trainer applications" });
            }
        });




        // 🟢 POST Review
        const reviewsCollection = db.collection("reviews");

        app.post("/reviews", async (req, res) => {
            try {
                const review = req.body;
                review.createdAt = new Date();
                await reviewsCollection.insertOne(review);
                res.json({ success: true, message: "Review submitted successfully" });
            } catch (err) {
                res.status(500).json({ error: "Failed to submit review" });
            }
        });

        // 🟢 GET Reviews by Trainer ID (for testimonials)
        app.get("/reviews/trainer/:trainerId", async (req, res) => {
            try {
                const reviews = await reviewsCollection.find({ trainerId: req.params.trainerId }).toArray();
                res.json(reviews);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch reviews" });
            }
        });

        // 🟢 Get All Reviews (for testimonials)
        app.get("/reviews", async (req, res) => {
            try {
                const reviewsCollection = db.collection("reviews");

                const reviews = await reviewsCollection
                    .find()
                    .sort({ createdAt: -1 }) // ✅ latest first
                    .toArray();

                res.json(reviews);
            } catch (err) {
                console.error("❌ Failed to fetch reviews:", err);
                res.status(500).json({ error: "Failed to fetch reviews", details: err.message });
            }
        });




        // 🟢 Get all booked trainers by user email
        app.get("/bookings/user/:email", async (req, res) => {
            try {
                const email = req.params.email;

                // ✅ Find all bookings for this user
                const bookings = await bookingsCollection
                    .find({ userEmail: email, status: "success" })
                    .sort({ createdAt: -1 })
                    .toArray();

                if (bookings.length === 0) {
                    return res.json([]);
                }

                // ✅ Extract trainer IDs
                const trainerIds = bookings.map((b) => new ObjectId(b.trainerId));

                // ✅ Fetch trainer details
                const trainers = await db.collection("trainers")
                    .find({ _id: { $in: trainerIds } })
                    .toArray();

                // ✅ Merge trainer details with bookings
                const mergedData = bookings.map((booking) => {
                    const trainerInfo = trainers.find((t) => t._id.toString() === booking.trainerId);
                    return {
                        ...booking,
                        trainerDetails: trainerInfo || null,
                    };
                });

                res.json(mergedData);
            } catch (err) {
                console.error("❌ Failed to fetch booked trainers:", err);
                res.status(500).json({ error: "Failed to fetch booked trainers" });
            }
        });



        // 🔹 Root Route
        app.get("/", (req, res) => {
            res.send("🏋️‍♂️ Fitness Tracker API is running...");
        });

    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
    }
}

run().catch(console.dir);

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
