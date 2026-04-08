const app = require('./app');
const env = require('./config/env');
const { initializeDatabase } = require('./database/schema');

initializeDatabase();

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
