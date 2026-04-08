# My Borrower API

Node.js and Express backend for the My Borrower loan tracking application.

Detailed endpoint documentation: [API_README.md](./API_README.md)

## Stack

- Express
- MongoDB via `mongoose`
- JWT authentication
- MVC-style structure with controllers, models, routes, services, and middleware

## Project Structure

```text
src/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env
```

3. Start the API:

```bash
npm run dev
```

The server defaults to `http://localhost:4000`.

## Main Endpoints

### Authentication

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/user`

### Loans

- `GET /api/loans`
- `POST /api/loans`
- `GET /api/loans/:id`
- `PUT /api/loans/:id`
- `PATCH /api/loans/:id/status`
- `DELETE /api/loans/:id`

### Payments and History

- `POST /api/loans/:id/payments`
- `GET /api/loans/:id/history`

## Notes

- Set `MONGO_URI` in `.env` to your local or hosted MongoDB connection string.
- `POST /api/logout` is stateless and expects the client to discard the JWT.
- Loan updates and payment writes are persisted in MongoDB collections.
