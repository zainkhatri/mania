import express from 'express';
import { 
  getJournalsByBook, 
  getJournal, 
  createJournal, 
  updateJournal, 
  deleteJournal 
} from '../controllers/journalController';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all journal routes
router.use(authenticate);

// Journal routes
router.get('/book/:bookId', getJournalsByBook);
router.get('/:journalId', getJournal);
router.post('/', createJournal);
router.put('/:journalId', updateJournal);
router.delete('/:journalId', deleteJournal);

export default router; 