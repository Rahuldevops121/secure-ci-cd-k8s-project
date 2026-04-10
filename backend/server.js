const express = require("express")
const mongoose = require("mongoose")

const app = express()

mongoose.connect("mongodb://mongodb:27017/devsecops")

app.get("/", async (req,res)=>{
    res.send("Backend connected to MongoDB successfully 🎉")
})

app.listen(3000, ()=> console.log("Backend running"))
