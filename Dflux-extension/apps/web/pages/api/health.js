export default async function handler(req, res) {
  return res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
}
