import 'dotenv/config'
import express from 'express'
import axios from 'axios'

// Load my client credentials from .env
const CLIENT_ID = process.env.TINK_CLIENT_ID;
const CLIENT_SECRET = process.env.TINK_CLIENT_SECRET;

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

// Use access_token to fetch transaction data
const fetchTransactions = async accessToken => {

    // Axios post request to /transactions endpoint
    const response = await axios.get('https://api.tink.com/data/v2/transactions?pageSize=10', {
        headers: {
            'Authorization': 'Bearer ' + accessToken 
        }
    });


    // Tink API response provides transactions as an array of objects
    // Loop through each transaction object and extract the necessary data
    // Have set this up to only capture 10 most recent transactions
    let i = 0

    while (i <= 9) {

        // Store required transaction information in variables
        const date = response.data.transactions[i].dates.booked
        const description = response.data.transactions[i].descriptions.original
        const unscaledValue = parseInt(response.data.transactions[i].amount.value.unscaledValue)
        const scale= parseInt(response.data.transactions[i].amount.value.scale) * -1
        const currency = response.data.transactions[i].amount.currencyCode

        // Use the unscaled value & scale to calculate the amount in a human friendly format
        const amount = unscaledValue * Math.pow(10, scale)

        // Pass the transaction information to outputData function
        outputData(date, description, amount, currency)

        // Increment counter
        i += 1
    }

}


const outputData = (date, description, amount, currency) => {
    // Transactions fetched are presented in the following format:
    // date (YYYY/MM/DD) - transaction description - amount - currency
    const positive_int = amount * -1

    console.log(date + ' - ' + description + ' - ' +  positive_int + ' - ' + currency)
}


/*----- BONUS: ANALYZE TRANSACTION DATA -----*/
