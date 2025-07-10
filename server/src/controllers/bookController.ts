import { Request, Response } from 'express';
import Book from '../models/Book';
import Journal from '../models/Journal';

// Get all books for the current user
export const getBooks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const books = await Book.find({ user: userId }).sort({ createdAt: -1 });
    
    res.json(books);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single book
export const getBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const userId = (req.user as any).id;

    const book = await Book.findOne({ _id: bookId, user: userId });
    
    if (!book) {
      res.status(404).json({ message: 'Book not found or access denied' });
      return;
    }
    
    res.json(book);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new book
export const createBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, coverImage, isDefault } = req.body;
    const userId = (req.user as any).id;

    // If this book is set as default, update any existing default books
    if (isDefault) {
      await Book.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
    }

    // Create the new book
    const newBook = new Book({
      name,
      description,
      coverImage,
      user: userId,
      isDefault: isDefault || false,
    });

    await newBook.save();
    
    res.status(201).json(newBook);
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a book
export const updateBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const { name, description, coverImage, isDefault } = req.body;
    const userId = (req.user as any).id;

    // Find book and verify ownership
    const book = await Book.findOne({ _id: bookId, user: userId });
    
    if (!book) {
      res.status(404).json({ message: 'Book not found or access denied' });
      return;
    }

    // If this book is being set as default, update any existing default books
    if (isDefault && !book.isDefault) {
      await Book.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
    }

    // Update book fields
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { name, description, coverImage, isDefault },
      { new: true }
    );
    
    res.json(updatedBook);
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a book
export const deleteBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const userId = (req.user as any).id;

    // Find book and verify ownership
    const book = await Book.findOne({ _id: bookId, user: userId });
    
    if (!book) {
      res.status(404).json({ message: 'Book not found or access denied' });
      return;
    }

    // Check if it's the default book
    if (book.isDefault) {
      res.status(400).json({ message: 'Cannot delete the default book' });
      return;
    }

    // Check if the book contains journals
    const journalCount = await Journal.countDocuments({ book: bookId });
    if (journalCount > 0) {
      res.status(400).json({ 
        message: 'Cannot delete a book that contains journals. Move or delete the journals first.' 
      });
      return;
    }

    await Book.findByIdAndDelete(bookId);
    
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 