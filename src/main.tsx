import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MockQuestionProvider } from './services/questions';
import { MockMaterialAnalysisProvider } from './services/materialAnalysis';
import './styles.css';
const questionProvider = new MockQuestionProvider();
const materialProvider = new MockMaterialAnalysisProvider();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App questionProvider={questionProvider} materialProvider={materialProvider} />
  </StrictMode>,
);
