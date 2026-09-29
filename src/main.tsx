import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MockQuestionProvider } from './services/questions';
import './styles.css';
const questionProvider = new MockQuestionProvider();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App questionProvider={questionProvider} />
  </StrictMode>,
);
