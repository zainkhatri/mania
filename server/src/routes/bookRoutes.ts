import express from 'express';
import { 
  getBooks, 
  getBook, 
  createBook, 
  updateBook, 
  deleteBook 
} from '../controllers/bookController';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all book routes
router.use(authenticate);

// Book routes
router.get('/', getBooks);
router.get('/:bookId', getBook);
router.post('/', createBook);
router.put('/:bookId', updateBook);
router.delete('/:bookId', deleteBook);

export default router; 