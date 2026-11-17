import mongoose, { Schema } from "mongoose";

/* Every uploaded image / video has one record here. The file itself lives on Cloudinary (`url`, `publicId`);
   the site shows it through /api/images/<id> (or /api/videos/<id>), which looks this record up and sends the
   browser to the Cloudinary URL. Older records (and installs without Cloudinary keys) keep the file bytes in `data`. */
const ImageSchema = new Schema(
  {
    data: { type: Buffer },
    contentType: { type: String, default: "image/webp" },
    size: Number,
    url: String, // Cloudinary https URL
    publicId: { type: String, index: true },
    resourceType: { type: String, enum: ["image", "video"], default: "image" },
    width: Number,
    height: Number,
    duration: Number, // seconds (videos)
  },
  { timestamps: true },
);

export const ImageModel = mongoose.models.Image || mongoose.model("Image", ImageSchema);
