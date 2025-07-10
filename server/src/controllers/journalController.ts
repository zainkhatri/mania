import { Request, Response } from 'express';
import Journal from '../models/Journal';
import Book from '../models/Book';

// Get all journals for a specific book
export const getJournalsByBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const userId = (req.user as any).id;

    // Verify the book belongs to the user
    const book = await Book.findOne({ _id: bookId, user: userId });
    if (!book) {
      res.status(404).json({ message: 'Book not found or access denied' });
      return;
    }

    const journals = await Journal.find({ book: bookId, user: userId })
      .sort({ createdAt: -1 });
    
    res.json(journals);
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single journal
export const getJournal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { journalId } = req.params;
    const userId = (req.user as any).id;

    const journal = await Journal.findOne({ _id: journalId, user: userId });
    
    if (!journal) {
      res.status(404).json({ message: 'Journal not found or access denied' });
      return;
    }
    
    res.json(journal);
  } catch (error) {
    console.error('Get journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new journal
export const createJournal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, bookId, images, mood, tags } = req.body;
    const userId = (req.user as any).id;

    // Verify the book exists and belongs to the user
    const book = await Book.findOne({ _id: bookId, user: userId });
    if (!book) {
      res.status(404).json({ message: 'Book not found or access denied' });
      return;
    }

    const newJournal = new Journal({
      title,
      content,
      user: userId,
      book: bookId,
      images,
      mood,
      tags,
    });

    await newJournal.save();
    
    res.status(201).json(newJournal);
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a journal
export const updateJournal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { journalId } = req.params;
    const { title, content, images, mood, tags } = req.body;
    const userId = (req.user as any).id;

    // Find journal and verify ownership
    const journal = await Journal.findOne({ _id: journalId, user: userId });
    
    if (!journal) {
      res.status(404).json({ message: 'Journal not found or access denied' });
      return;
    }

    // Update journal fields
    const updatedJournal = await Journal.findByIdAndUpdate(
      journalId,
      { title, content, images, mood, tags },
      { new: true }
    );
    
    res.json(updatedJournal);
  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a journal
export const deleteJournal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { journalId } = req.params;
    const userId = (req.user as any).id;

    // Find journal and verify ownership
    const journal = await Journal.findOne({ _id: journalId, user: userId });
    
    if (!journal) {
      res.status(404).json({ message: 'Journal not found or access denied' });
      return;
    }

    await Journal.findByIdAndDelete(journalId);
    
    res.json({ message: 'Journal deleted successfully' });
  } catch (error) {
    console.error('Delete journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 