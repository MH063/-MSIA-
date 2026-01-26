import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import patientRoutes from './routes/patient.routes';
import sessionRoutes from './routes/session.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import nlpRoutes from './routes/nlp.routes';
import diagnosisRoutes from './routes/diagnosis.routes';
import mappingRoutes from './routes/mapping.routes';
import { FileWatcherService } from './services/fileWatcher.service';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Initialize Knowledge Base Watcher
const KNOWLEDGE_BASE_DIR = process.env.KNOWLEDGE_BASE_DIR || path.join(__dirname, '../knowledge_base');
const fileWatcher = new FileWatcherService(KNOWLEDGE_BASE_DIR);
fileWatcher.start();

app.use(cors());
app.use(express.json());

app.use('/api/patients', patientRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/nlp', nlpRoutes);
app.use('/api/diagnosis', diagnosisRoutes);
app.use('/api/mapping', mappingRoutes);

/**
 * 健康检查接口
 * @route GET /
 * @returns {object} { message: string }
 */
app.get('/', (req: Request, res: Response) => {
  res.send({ message: 'MSIA Backend API is running' });
});

/**
 * 启动服务器
 */
app.listen(port, () => {
  const tip = '请使用本机网卡IP访问，如 http://<本机IP>:' + port;
  console.log(`[Server]: 服务已启动，端口 ${port}。${tip}`);
});
