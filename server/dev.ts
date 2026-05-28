import { app } from '../api/index'

const port = Number(process.env.PORT ?? 3001)

app.listen(port, () => {
  process.stdout.write(`API on http://localhost:${port}\n`)
})

