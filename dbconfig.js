const config = {
    user :'bid_user_001',
    password :'server_pass@123',
    server:'bid-ai4bi-poc.database.windows.net',
    database:'BI_Arena',
    options:{
        trustedconnection: true,
        enableArithAbort : true, 
        instancename :'bid-ai4bi-poc.database.windows.net'
    },
    port : 1433
}

module.exports = config; 