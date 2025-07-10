import mongoose, { Document, Schema } from 'mongoose';

export interface IJournal extends Document {
  title: string;
  content: string;
  user: mongoose.Types.ObjectId;
  book: mongoose.Types.ObjectId;
  images?: string[];
  mood?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const JournalSchema = new Schema<IJournal>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    book: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    images: [{
      type: String,
    }],
    mood: {
      type: Number,
      min: 1,
      max: 10,
    },
    tags: [{
      type: String,
      trim: true,
    }],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IJournal>('Journal', JournalSchema); 