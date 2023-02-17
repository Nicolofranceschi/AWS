import { FastifyInstance } from "fastify"
import { get, post, put } from "../utils/fetch";
import { randomUUID } from 'node:crypto';

const DB_NAME = 'data';
console.log(process.env)

export default async function routes (fastify: FastifyInstance) {

  fastify.get('/', async () => {
    return { pong: 'it worked! and also CI and https' }
  })

  fastify.get('/collection', async () => {
    console.log(process.env.INTERNAL_QDRANT_HOST);
    return await get(`${process.env.INTERNAL_QDRANT_HOST}/collections`);
  });

  fastify.post('/init', async () => {
    return await put(`${process.env.INTERNAL_QDRANT_HOST}/collections/${DB_NAME}`, {
      name: DB_NAME,
      vectors: {
        size: 1536,
        distance: "Cosine"
      }
    });
  });

  fastify.post('/add', { schema: { body: { context: { type: 'string' } } } }, async (request) => {
    const { context } = request.body as { context: string };
    const { data } = await post('https://api.openai.com/v1/embeddings', {
      input: context,
      model: "text-embedding-ada-002"
    });
    if (!data.length) throw new Error('No data returned from OpenAI');
    const { embedding } = data[0];
    const res = await put(`${process.env.INTERNAL_QDRANT_HOST}/collections/${DB_NAME}/points`, {
      points: [
        {
          id: randomUUID(),
          vector: embedding
        }
      ]
    });
    return res;
  });
}
