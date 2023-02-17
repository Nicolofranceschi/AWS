import fastify from 'fastify';
import env from '@fastify/env';
import routes from './routes';

const schema = {
type: 'object',
required: ['OPENAI_API_KEY',"INTERNAL_QDRANT_HOST","POD_IP"],
  properties: {
    OPENAI_API_KEY: {
      type: 'string',
    }
  }
}

const server = fastify({
  logger: true
});

server.register(env, { dotenv: true, schema, data: process.env })

server.register(routes);

const start = async () => {
  try {
    await server.listen({ port: 3000 , host: process.env.POD_IP })
  } catch (err) {
    server.log.error(err)
    process.exit(1);
  }
}
start()
