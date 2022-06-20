import 'dotenv/config'
import express from 'express'
import axios from 'axios'

// Load my client credentials from .env
const CLIENT_ID = process.env.TINK_CLIENT_ID;
const CLIENT_SECRET = process.env.TINK_CLIENT_SECRET;

// Initialise Transaction data array
let transactions_data = []

const app = express()

const PORT = process.env.PORT || 3000

app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

/*----- STEP ONE: BUILD MY TINK LINK URL -----*/

// localhost:3000 redirects to my Tink Link URL.
// User can authenticate the connection to the Tink Demo Bank 
app.get('/', function (req, res) {
    res.redirect('https://link.tink.com/1.0/transactions/connect-accounts/?client_id=c1b813fe0e7a470599c45b0856a9a48c&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&market=GB&locale=en_US&test=true');
 })

/*----- STEP TWO: HANDLE THE CALLBACK -----*/

// Redirect URI set in the console: localhost:3000/callback
// When a user successfully reaches the end of a Tink Link flow
// this route handles the callback
app.get('/callback', function(req, res) {

    // Obtain OAuth code form URL parameters
    const code = req.query.code;

    // Display OAuth code
    res.send({
        'OAuth': code,
      });

    // Pass OAuth code to getAccessToken function
    getAccessToken(code)
  
});

/*----- STEP THREE: AUTHENTICATE MY CLIENT -----*/

// Function to exchange OAuth code for an access_token
const getAccessToken = async code => {

    // Axios post request to /oauth/token endpoint
    const response = await axios.post(
        'https://api.tink.com/api/v1/oauth/token',
        'code=' + code + '&client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&grant_type=authorization_code',
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    )

    fetchTransactions(response.data.access_token)
}

/*----- STEP FOUR: FETCH TRANSACTION DATA -----*/

// Use access_token to fetch first page of transaction data
const fetchTransactions = async accessToken => {

    // Axios post request to /transactions endpoint
    const response = await axios.get('https://api.tink.com/data/v2/transactions?pageSize=100', {
        headers: {
            'Authorization': 'Bearer ' + accessToken 
        }
    });

    // Tink API response provides transactions as an array of objects
    // Pass this array to extractData function to get the required information
    extractData(response.data.transactions)

    // Call fetchNextPage function to get more results, pass nextPageToken from the repsonse.
    fetchNextPage(accessToken, response.data.nextPageToken)

}

const fetchNextPage = async (accessToken, nextPageToken) => {
        
    // Axios post request to /transactions endpoint
    const response = await axios.get('https://api.tink.com/data/v2/transactions?pageSize=100&pageToken=' + nextPageToken, {
        headers: {
            'Authorization': 'Bearer ' + accessToken 
        }
    })

    // Tink API response provides transactions as an array of objects
    // Pass this array to extractData function to get the required information
    extractData(response.data.transactions)

    if (transactions_data.length == 500) {
        bonusTask(transactions_data)
    } else {
        fetchNextPage(accessToken, response.data.nextPageToken)
    }
}

const extractData = transactions => {

    // Loop through each object in the transactions array and extract the necessary data
    for (let i = 0; i < transactions.length; i++) { 

        // Store required transaction information in variables
        const date = transactions[i].dates.booked
        const description = transactions[i].descriptions.original
        const unscaledValue = parseInt(transactions[i].amount.value.unscaledValue)
        const scale= parseInt(transactions[i].amount.value.scale) * -1
        const currency = transactions[i].amount.currencyCode
     
        // Use the unscaled value & scale to calculate the amount in a human friendly format
        const val = unscaledValue * Math.pow(10, scale)
        const amount = Math.round(amount * 100) / 100
     
        // Create a transaction object for each transaction
        const transaction = {
            date: date,
            description: description,
            amount: amount,
            currency: currency
        }
     
        // Add each transaction object to the transactions_data array
        transactions_data.push(transaction)
        
    }
   
    if (transactions_data.length == 500) {
        console.log(transactions_data)
    }
}

// subtractMonths takes todays date and subtracts 3 months & 1 day
// then formats the date to match the dataset (YYYY-MM-DD). 
const subtractMonths = (numOfMonths, date = new Date()) => {

    let d = date
    d.setDate(d.getDate() - 1)
    d.setMonth(d.getMonth() - numOfMonths)

    // Format date to YYYY-MM-DD (Same as dataset)
    const date_formatted = d.toISOString().split('T')[0]

    return date_formatted;
}


/*----- BONUS: ANALYZE TRANSACTION DATA -----*/

const bonusTask = transactions_data => {

    // Find the index of date minus 3 months
    const index = transactions_data.findIndex(object => {
        return object.date === subtractMonths(3);
    });

    // Remove transactions from the array older than 3 months
    transactions_data.splice(index, transactions_data.length); 

    // Create an object for each unique transaction description
    // & Count frequency with which each description occurs in the dataset
    // Store these description objects in an array
    // E.G unique_descriptions = [{description: xxx, count: 10},{description: yyy, count: 9}]
    const grouped = transactions_data.reduce((groups, cur) => {
        const key = cur.description;
    
        groups[key] = (groups[key] || 0) + 1;
    
        return groups;
    }, {});
    
    const unique_descriptions = Object.keys(grouped).map(key => ({description: key, count: grouped[key]}));

    // Sort - most frequent descriptions will occur first in the array
    unique_descriptions.sort((a, b) => b.count - a.count)
    
    console.log(unique_descriptions);

}

