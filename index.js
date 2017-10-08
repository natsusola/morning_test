const express = require('express');

const app = express();
const port = 3030;

const items = require('./routers/items.js');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type');
  next();
});

app.use('/item', items);
app.use('/rwd', express.static(__dirname + '/rwd'));
app.use('/', express.static(__dirname + '/public'));

app.listen(port, () => {
  console.log(`Server is starting at port: ${port}!`);
});
