const express = require('express');
const router = express.Router();
const _ = require('lodash');
const cheerio = require('cheerio');
const request = require('request-promise');

const VENDORS = {
  books: {
    name: '博客來',
    queryUrl: _.template(`http://search.books.com.tw/search/query/key/<%= key %>/cat/all`)
  },
  pchome: {
    name: 'PChome',
    queryUrl: _.template(`http://ecshweb.pchome.com.tw/search/v3.3/all/results?q=<%= key %>&page=1&sort=rnk/dc`)
  },
};

router.use((req, res, next) => { next(); });

router.get('/list', (req, res) => {
  let promises = _.map(VENDORS, (v, k) => crawl(k, encodeURIComponent(req.query.key)));
  Promise.all(promises)
    .then(results => {
      res.send({
        code: 200,
        msg: 'success',
        items: _.flatten(results)
      });
    });
});

function crawl(vid, key) {
  return new Promise((resolve) => {
    let vendor = VENDORS[vid];
    request(vendor.queryUrl({key}))
      .then(res => {
        switch (vid) {
          case 'books':
            resolve(booksHandler(res, vendor));
            break;
          case 'pchome':
            resolve(pchomeHandler(res, vendor));
            break;
          default:
            resolve([]);
            break;
        }
      })
      .catch(() => { resolve([]); });
  });
}

function booksHandler(htmlStr, vendor) {
  let $ = cheerio.load(htmlStr);
  let results = $('.searchbook > .item');
  /* if no results */
  if (!results.length) return [];

  /* format results */
  let items = [];
  results.each((i, elem) => {
    let imgElem = $(elem).children('a[rel="mid_image"]');
    let title = imgElem.attr('title');
    let url = imgElem.attr('href');
    let img = imgElem.children('img').data('original');
    let price = $(elem).children('.price').children('strong').children('b').last().text();
    items.push({
      title, price, img, url, vendor: vendor.name
    });
  });
  return items;
}

function pchomeHandler(res, vendor) {
  let items = JSON.parse(res).prods.map(item => ({
    title: item.name,
    price: item.price,
    img: `//a.ecimg.tw${item.picS}`,
    url: `//24h.pchome.com.tw/prod/${item.Id}`,
    vendor: vendor.name
  }));
  return items;
}

module.exports = router;
