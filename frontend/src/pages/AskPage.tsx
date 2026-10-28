import { useParams } from 'react-router-dom';
import QuestionForm from '../components/QuestionForm';

// Reads the message and the per-field errors (err.fields) off whatever was thrown.
// /ask and /questions/:id/edit render this same component. The key makes React
// start with fresh state when you move between them (or between two questions).
export default function AskPage() {
	const { id } = useParams<{ id: string }>();
	return <QuestionForm key={id ?? 'new'} id={id} />;
}

