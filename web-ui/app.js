const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

// Read the configuration file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const port = `${config.listen_port}`

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/unwrap', async (req, res) => {
  const token = req.body.token;
  
  try {
    const response = await axios.post(`${config.vault_address}/v1/sys/wrapping/unwrap`, {}, {
      headers: {
        'X-Vault-Token': token
      }
    });
    
    if (response.data && response.data.data) {
      res.json({ success: true, data: JSON.stringify(response.data.data, null, 2) });
    } else {
      res.json({ success: false, error: 'Invalid response format' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
