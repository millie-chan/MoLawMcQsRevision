# 2024-07-14 Day 1
1. 決定要做的項目及所用language/library：
    1. mobile app
        1. Flutter
        2. GetWidget: https://pub.dev/packages/getwidget
    2. 功能為溫習430法例選擇題
        1. 需要從官網PDF中截取相關內容並轉換成csv格式或json格式
        2. 目前決定用nodejs寫，如果之後要跳出舒適圈，則使用python
    3. 以Leitner System的溫習方法顯示當天需要溫習的選擇題
2. 決定mobile app的學習路線
    1. build helloworld app following https://developer.android.com/codelabs/basic-android-kotlin-compose-first-app?hl=zh-tw#1
    2. read https://medium.com/@ntougpslab/1-android-%E5%AE%89%E8%A3%9D%E8%88%87hello-world-8de5d9c0b40b
    3. build the app with Flutter following https://ithelp.ithome.com.tw/articles/10294783
    4. try to use GetWidget
    5. try to show the multiple choice questions in csv/json
    6. try to add Google Advertisement
    7. try to apply Leitner System
3. 安裝Android Studio

# 2024-07-15 Day 2
1. nodejs，選用pdf2json，因為文件較細，最後更新日期亦更近
2. 只完成了讀取目錄的部份

# 2024-07-16
1. 能讀取問題及答案，但超出100條問題時題號會錯，另外連續執行所有法例會報錯

# 2024-07-17
1. 處理超出100題後或會出現的題號分開問題
2. 處理答案表中題號和答案不在同一字串的情況
3. 發現從《政府部門及實體的組織、職權及運作》行政法規開始，只能讀到第一條問題的答案