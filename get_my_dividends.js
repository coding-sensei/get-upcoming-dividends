var SPREADSHEET_ID = "UPDATE THIS WITH YOUR GOOGLE SHEET ID";
var TICKER_SHEET_NAME = "tickers";
var DIVIDEND_SHEET_NAME = "latest_dividends";

function initMenu() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu("Dividends Tools");
  menu.addItem("Get Upcoming Dividends", "update_dividend_info");
  menu.addToUi();
}

function onOpen() {
  initMenu();
}

function update_dividend_info() {
  Logger.log("Ticker: ");
  var tickers = get_tickers();
  var upcoming_payments = get_upcoming_dividends(tickers);
}

function get_upcoming_dividends(tickers) {
  var token = get_token();
  var tickers_with_payments = [];

  for (var i= 0; i < tickers.length; i++) {
    Logger.log("Ticker: " + tickers[i]);
    var ticker_data = get_stock_history(token, tickers[i]);
    var ticker_next_payments = get_ticker_next_payments(ticker_data);
    tickers_with_payments = tickers_with_payments.concat(ticker_next_payments);

  }

  clear_sheet()
  create_header(tickers_with_payments[0]);
  for (var i= 0; i < tickers_with_payments.length; i++) {
    Logger.log("Upcoming payments");
    Logger.log(tickers_with_payments);
    write_to_sheet(tickers_with_payments[i]);
  }

}

function get_token() {
  var response = UrlFetchApp.fetch("https://seekingalpha.com/market_data/xignite_token");
  return JSON.parse(response.getContentText());
}

function get_tickers() {
  var ws = get_sheet_object(TICKER_SHEET_NAME);
  var list = ws.getRange(1,1, ws.getRange("A1").getDataRegion().getLastRow(), 1).getValues();
  var t = list.map(function(r){ return r[0]; });
  return t
}

function get_sheet_object(sheet_name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(sheet_name);
}

function get_stock_history(token, ticker) {
  url = "https://globalhistorical.xignite.com/v3/xGlobalHistorical.json/GetCashDividendHistory?"
        + "IdentifierType=Symbol&Identifier=" + ticker
        + "&StartDate=01/01/2000&EndDate=12/30/2022&"
        + "IdentifierAsOfDate=&CorporateActionsAdjusted=true&_token="
        + token._token + "&_token_userid=" + token._token_userid

  Logger.log(url);
  var response = UrlFetchApp.fetch(url);
  return JSON.parse(response.getContentText());
}

function clear_sheet() {
  var ws = get_sheet_object(DIVIDEND_SHEET_NAME);
  ws.getRange("A:O").clear();
}

function create_header(ticker_data) {
  var ws = get_sheet_object(DIVIDEND_SHEET_NAME);
  var headerRow = Object.keys(ticker_data.CashDividends[0]);
  headerRow.unshift("Ticker");
  ws.appendRow(headerRow);
}

function get_ticker_next_payments(ticker_data) {
  var today = new Date().getFullYear()+'-'+("0"+(new Date().getMonth()+1)).slice(-2)+'-'+("0"+new Date().getDate()).slice(-2);
  var dividends = ticker_data.CashDividends;
  var payments = [];
  for (var i=0; i < dividends.length; i++) {
    pay_date = dividends[i].PayDate
    Logger.log("paydate: " + pay_date);
    if (Date.parse(pay_date) >= Date.parse(today)) {
      Logger.log("Inside If");
      dividends[i] = calculate_dividend_increase(dividends[i], dividends[i+1])
      dividends[i].AnnualPayout = dividends[i].DividendAmount * 4
      payments.push(dividends[i]);
    }
  }
  Logger.log("payments: " + payments);
  ticker_data.CashDividends = payments;
  return ticker_data
}

function calculate_dividend_increase(current_dividend, previous_dividend) {
  current_dividend.PreviousDividendAmount = 0;
  current_dividend.PercentIncrease = 0;

  try {
    if(current_dividend.DividendAmount == previous_dividend.DividendAmount){
      Logger.log("Current Dividend Amount and Previous match so no raise!");
      current_dividend.PreviousDividendAmount = previous_dividend.DividendAmount;
      return current_dividend
    }
  } catch(err) {
     Logger.log("Unable to compare current and previous dividend amount!");
     return current_dividend
  }

  var raise = 1 - previous_dividend.DividendAmount/current_dividend.DividendAmount;
  current_dividend.PreviousDividendAmount = previous_dividend.DividendAmount;
  current_dividend.PercentIncrease = raise;

  return current_dividend
}

function write_to_sheet(json) {
  if(json.CashDividends.length == 0){
    return
  }
  var ticker = json.Security.Symbol;
  var json = json.CashDividends;
  var ws = get_sheet_object(DIVIDEND_SHEET_NAME);


  for (var i= 0; i < json.length; i++) {
    var headerRow = Object.keys(json[0]);
    var row = headerRow.map(function(key){ return json[i][key]});
    row.unshift(ticker);
    ws.appendRow(row);
  }
}
