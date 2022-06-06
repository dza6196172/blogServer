const express = require('express')
const router = express.Router()
const db = require('../db/index')

router.get('/getStatistic', (req, res) => {
  let allresult = {}
  let p1 = new Promise((resolve, reject) => {
    db.query(`SELECT * FROM watch_count ORDER BY date DESC LIMIT 0,8`, (err, results) => {
      if (err) {
        res.error(err)
        reject()
      }
      allresult.watchLineList = results
      resolve()
    })
  })
  let p2 = new Promise((resolve, reject) => {
    db.query(`SELECT SUM(watch) 'watch', (
        SELECT COUNT(*) FROM comment
      ) 'comment',
      (SELECT COUNT(*) FROM article) 'article',
      (SELECT COUNT(*) FROM users) 'users'
       FROM article`, (err, results) => {
      if (err) {
        res.error(err)
        reject()
      }
      allresult.statisticCount = results[0]
      resolve()
    })
  })
  let p3 = new Promise((resolve, reject) => {
    db.query(`SELECT article_id,title,watch,(
      SELECT SUM(watch) FROM article
    ) allcount FROM article
    ORDER BY watch DESC LIMIT 0,6;`, (err, results) => {
      if (err) {
        res.error(err)
        reject()
      }
      allresult.articleCount = results
      resolve()
    })
  })
  let p4 = new Promise((resolve, reject) => {
    db.query(`SELECT create_date,COUNT(article_id) count FROM article
  GROUP BY DATE(create_date)`, (err, results) => {
      if (err) {
        res.error(err)
        reject()
      }
      allresult.commitCount = results
      resolve()
    })
  })

  Promise.all([p1, p2, p3, p4]).then(result => {
    res.send({ code: 200, msg: '获取数据成功', data: allresult })
  })


})

module.exports = router