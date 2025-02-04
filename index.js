var config = require('./dbconfig');
const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const axios = require("axios");
const multer = require('multer');
const path = require('path');
const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("Database Connection Failed! Bad Config: ", err);
    throw err;
  });
  const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,'public/upload')
    },
    filename:(req,file,cb)=>{
         console.log("21",file)
        cb(null,file.originalname.split(".")[0] + "_" + Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({
    storage:storage
})
  app.get("/getReports", async (req, res) => {
    try {
      // Query for reports
      const reportQuery = `
      SELECT pbi.Workspace_ID, pbi.Report_ID, pbi.Report_Name,pbi.Fav_Grp,DATEPART(year, pbi.Last_Refresh_Date) AS Refresh_Year,DATEPART(day, pbi.Last_Refresh_Date) AS Refresh_Date ,Format( (pbi.Last_Refresh_Date),'MMMM')  AS Refresh_Month,pbi.Embed_Url,
        pbi.Image_Url
        FROM [dbo].[PBI_Info] as pbi 
        
      `;
  
      const pool = await poolPromise;
      const request = pool.request();
  
      // Execute the query
      const [reportResult] = await Promise.all([request.query(reportQuery)]);
  
      // Prepare the response
      const reports = reportResult.recordset;
  
      // Send response
      if (reports.length > 0) {
        res.status(200).json({ reports });
      } else {
        res.status(404).json({
          message: "No reports found",
          reports: [],
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err.message);
      res.status(500).json({ message: "Error fetching data", error: err.message });
    }
  });
  app.get("/getInsights", async (req, res) => {
    try {
      // Query for reports
      const InsightQuery = `
        select B.Report_Name,A.* from Insights A INNER JOIN PBI_Info B ON A.Report_ID = B.Report_ID
      `;
  
      const pool = await poolPromise;
      const request = pool.request();
  
      // Execute the query
      const [InsightResult] = await Promise.all([request.query(InsightQuery)]);
  
      // Prepare the response
      const insights = InsightResult.recordset;
  
      // Send response
      if (insights.length > 0) {
        res.status(200).json({ insights });
      } else {
        res.status(404).json({
          message: "No records found",
          insights: [],
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err.message);
      res.status(500).json({ message: "Error fetching data", error: err.message });
    }
  });
  app.get("/getDataSourceInfo", async (req, res) => {
    try {
      // Query for reports
      const dataSourceQuery = `
        select pb.Workspace_ID,pb.Report_Name,ds.* from Datasource_Info as ds INNER JOIN [dbo].[PBI_Info] as pb ON pb.Report_ID = ds.Report_ID 
      `;
  
      const pool = await poolPromise;
      const request = pool.request();
  
      // Execute the query
      const [dataSourceResult] = await Promise.all([request.query(dataSourceQuery)]);
  
      // Prepare the response
      const datasource = dataSourceResult.recordset;
  
      // Send response
      if (datasource.length > 0) {
        res.status(200).json({ datasource });
      } else {
        res.status(404).json({
          message: "No records found",
          datasource: [],
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err.message);
      res.status(500).json({ message: "Error fetching data", error: err.message });
    }
  });
  app.get("/getInsightsInfo", async (req, res) => {
    try {
      // Query for reports
      const insightsQuery = `
       select pb.Workspace_ID,pb.Report_Name,ins.* from Insights as ins INNER JOIN [dbo].[PBI_Info] as pb ON pb.Report_ID = ins.Report_ID 
      `;
  
      const pool = await poolPromise;
      const request = pool.request();
  
      // Execute the query
      const [insightsResult] = await Promise.all([request.query(insightsQuery)]);
  
      // Prepare the response
      const insights = insightsResult.recordset;
  
      // Send response
      if (insights.length > 0) {
        res.status(200).json({ insights });
      } else {
        res.status(404).json({
          message: "No records found",
          datasource: [],
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err.message);
      res.status(500).json({ message: "Error fetching data", error: err.message });
    }
  });
  app.post("/upload-data", async (req, res) => {
    try {
      
      console.log("100",req.body);
      const {
        workspace_id,
        report_id,
        report_name,
        url,
        brief_description,
        dataSources,
        kpis,
      } = req.body;
      const pool = await poolPromise;
       //Start a transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
  
      try {
        // Insert data into PBI_Info table
        await transaction
          .request()
          .input("workspace_id", sql.VarChar(80), workspace_id)
          .input("report_id", sql.VarChar(80), report_id)
          .input("report_name", sql.VarChar(50), report_name)
          .input("url", sql.VarChar(255), url)
          .input("brief_description", sql.VarChar(255), brief_description)
          .query(`MERGE INTO PBI_Info AS target
            USING (VALUES (@report_id,@workspace_id,
            @report_name,@url,@brief_description)) AS source 
            (Report_ID,Workspace_ID,Report_Name,Embed_Url,Report_Description)
            ON target.Report_ID = source.Report_ID
            WHEN MATCHED THEN
            UPDATE SET target.Report_Name = source.Report_Name,
	          target.Workspace_ID = source.Workspace_ID,
            target.Embed_Url = source.Embed_Url,
            target.Report_Description = source.Report_Description,
            target.Last_Refresh_Date=GETDATE()
            WHEN NOT MATCHED THEN
            INSERT (Report_ID,Workspace_ID, Report_Name,Embed_Url,Report_Description,Last_Refresh_Date)
            VALUES (source.Report_ID,source.Workspace_ID,source.Report_Name,source.Embed_Url,source.Report_Description,GETDATE());`);
  
        // Insert data into Datasource_Info table
        // if(dataSources.length)
        for (const datasource of dataSources) 
        {
          if(datasource.tableName!='' && (datasource.type!='' || datasource.description!=''))
          {
            await transaction
            .request()
            .input("report_id", sql.VarChar(80), report_id)
            .input("type", sql.VarChar(50), datasource.type)
            .input("tableName", sql.VarChar(50), datasource.tableName)
            .input("description", sql.VarChar(255), datasource.description)
            .query(`MERGE INTO Datasource_Info AS target
            USING (VALUES (@report_id,@tableName,
            @type,@description)) AS source 
            (Report_ID,Table_Name,Datasource_Type,Description)
            ON target.Report_ID = source.Report_ID and target.Table_Name = source.Table_Name
            WHEN MATCHED THEN
            UPDATE SET target.Datasource_Type = source.Datasource_Type,
	          target.Description = source.Description
	
            WHEN NOT MATCHED THEN
            INSERT (Report_ID,Table_Name,Datasource_Type,Description)
            VALUES (source.Report_ID,source.Table_Name,source.Datasource_Type,source.Description);`);
          }
          
        }
  
        // Insert data into KPI_Info table
        for (const kpi of kpis) 
        {
          if(kpi.kpi!='' && kpi.description!='')
            {
              await transaction
            .request()
            .input("report_id", sql.VarChar(80), report_id)
            .input("kpi", sql.VarChar(100), kpi.kpi)
            .input("description", sql.VarChar(255), kpi.description)
            .query(`MERGE INTO KPI_Info AS target
            USING (VALUES (@report_id,@kpi,
            @description)) AS source 
            (Report_ID,KPI,Description)
            ON target.Report_ID = source.Report_ID and target.KPI = source.KPI
            WHEN MATCHED THEN
            UPDATE SET 
            target.Description = source.Description
            WHEN NOT MATCHED THEN
            INSERT (Report_ID,KPI,Description)
            VALUES (source.Report_ID,source.KPI,source.Description);`);
            }
          
        }
  
        // Commit the transaction
        await transaction.commit();
        res.status(200).send({ message: "Data uploaded successfully" });
      } catch (err) {
        // Rollback the transaction in case of an error
        await transaction.rollback();
        console.error("Transaction Error:", err);
        res
          .status(500)
          .send({ message: "Error uploading data", error: err.message });
      }
    } catch (err) {
      console.error("Error:", err);
      res.status(500).send({ message: "Server error", error: err.message });
    }
  });
  // Delete Report
app.delete('/delete-record', async (req, res) => {
    try {
      const { report_id } = req.body;
  
      if (!report_id) {
        return res.status(400).json({ message: 'Report ID is required' });
      }
  
      const query=`
      DELETE FROM KPI_Info WHERE Report_ID = @report_id
      DELETE FROM Datasource_Info WHERE Report_ID = @report_id
      DELETE from Insights where Report_ID=@report_id
      DELETE FROM PBI_Info WHERE Report_ID = @report_id
      `
      const pool = await poolPromise;
      const result = await pool.request()
        .input('report_id', sql.VarChar(80), report_id)
        .query(query);
  
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({status:200, message: `Record with Report_ID ${report_id} deleted successfully` });
      } else {
        res.status(404).json({ status:404,message: `No record found with Report_ID ${report_id}` });
      }
    } catch (err) {
      console.error('Error deleting record:', err.message);
      res.status(500).json({status:500, message: 'Error deleting record', error: err.message });
    }
  });
  //Set Favourite
app.put('/update-fav-grp', async (req, res) => {
    try {
      const { report_id, fav_grp } = req.body;
  
      if (!report_id || !fav_grp) {
        return res.status(400).json({ message: 'Both report_id and fav_grp are required' });
      }
  
      const pool = await poolPromise;
  
      const result = await pool.request()
        .input('report_id', sql.VarChar(80), report_id)
        .input('fav_grp', sql.VarChar(50), fav_grp)
        .query(`
          UPDATE PBI_Info
          SET fav_grp = @fav_grp
          WHERE Report_ID = @report_id
        `);
  
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({status:200, message: `Successfully updated favourite group for Report_ID ${report_id}` });
      } else {
        res.status(404).json({status:404, message: `No record found for Report_ID ${report_id}` });
      }
    } catch (err) {
      console.error('Error updating fav_grp:', err.message);
      res.status(500).json({ message: 'Error updating favourite group', error: err.message });
    }
  });
  //Rename fav
  app.put('/rename-fav-grp', async (req, res) => {
    try {
      const {newname,oldname } = req.body;
  
      if (!newname) {
        return res.status(400).json({ message: ' new name are required' });
      }
  
      const pool = await poolPromise;
  
      const result = await pool.request()
        .input('newname', sql.VarChar(50), newname)
        .input('oldname', sql.VarChar(50), oldname)
        .query(`
          UPDATE PBI_Info
          SET fav_grp = @newname
          WHERE fav_grp = @oldname
        `);
  
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({status:200, message: `Successfully updated favourite group name` });
      } else {
        res.status(404).json({status:404, message: `No record found ` });
      }
    } catch (err) {
      console.error('Error updating fav_grp name:', err.message);
      res.status(500).json({ message: 'Error updating favourite group name', error: err.message });
    }
  });
  //Delete fav name
  app.put('/delete-fav-grp', async (req, res) => {
    try {
      const {favname} = req.body;
  
      if (!favname) {
        return res.status(400).json({ message: '  name is required' });
      }
  
      const pool = await poolPromise;
  
      const result = await pool.request()
        .input('favname', sql.VarChar(50), favname)
        
        .query(`
          UPDATE PBI_Info
          SET fav_grp = ''
          WHERE fav_grp = @favname
        `);
  
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({status:200, message: `Successfully deleted favourite group name` });
      } else {
        res.status(404).json({status:404, message: `No record found ` });
      }
    } catch (err) {
      console.error('Error updating fav_grp name:', err.message);
      res.status(500).json({ message: 'Error deleting favourite group name', error: err.message });
    }
  });
  app.put('/pinInsight', async (req, res) => {
    try {
      const { report_id} = req.body;
  
      
  
      const toggleQuery = `
        UPDATE Insights
        SET is_pinned = CASE 
                          WHEN is_pinned = 1 THEN 0 
                          ELSE 1 
                        END
        WHERE Report_Id = @report_id 
      `;
  
      const pool = await poolPromise;
      const request = pool.request();
  
      // Add input parameters to prevent SQL injection
      request.input('report_id', report_id);
      
  
  
      const result = await request.query(toggleQuery);
  
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({
          message: "is_pinned value successfully toggled.",
        });
      } else {
        res.status(404).json({
          message: "No matching record found to update.",
        });
      }
    } catch (error) {
      console.error("Error toggling is_pinned:", error.message);
  
      res.status(500).json({
        message: "Error toggling is_pinned",
        error: error.message,
      });
    }
  });
  // Generate Insights
app.get("/getInsight", async (req, res) => {
  try {
    // Extract query parameters from the request
    const { query, workspace_id,dataset_id, dataset_name } = req.query;
    console.log("345",query, workspace_id,dataset_id, dataset_name)
    const dataset_mode='PBI';
    // Check for missing required parameters
    if (!query || !workspace_id || !dataset_mode || !dataset_id || !dataset_name) {
      return res.status(400).json({
        message: "Missing required parameters: query, workspace_id, dataset_mode, dataset_id, dataset_name",
      });
    }

    // Define the URL to make the HTTP POST request
    const postUrl = "https://prod-100.westus.logic.azure.com:443/workflows/533538489998456680a5593554875c1e/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LlWGziEXI_FJfkirCPsNKbLXaeBtWrh1Xhs4eZPdVIE";

    // Prepare the request body as per the given schema
    const requestBody = {
      query,
      dataset_mode,
      workspace_id,
      dataset_id,
      dataset_name,
    };

    // Make the HTTP POST request
    const response = await axios.post(postUrl, requestBody);

    // Extract the "summary" and "dax" from the response
    const { summary, dax } = response.data;

    // Send the response back to the client
    res.status(200).json({
      summary,
      dax,
    });
  } catch (error) {
    console.error("Error fetching insight:", error.message);

    // Handle errors gracefully
    res.status(500).json({
      message: "Error fetching insight",
      error: error.message,
    });
  }
});
// Save Insights
app.put('/saveInsights', async (req, res) => {
  try {
    // Extract parameters from the request body
    const { report_id, query_title, dax_query} = req.body;
    const pinnedStatus=1;

    // Validate required fields
    if (!report_id || !query_title || !dax_query) {
      return res.status(400).json({
        message: "Missing required fields: report_id, query_title, dax_query",
      });
    }


    // SQL Query to insert into Insights table
    const insertQuery = `
      INSERT INTO Insights (Report_Id, Query_Title, DAX_Query, is_pinned)
      VALUES (@report_id, @query_title, @dax_query, @is_pinned)
    `;

    // Connect to the database
    const pool = await poolPromise;
    const request = pool.request();

    // Add input parameters to prevent SQL injection
    request.input('report_id', report_id);
    request.input('query_title', query_title);
    request.input('dax_query', dax_query);
    request.input('is_pinned', pinnedStatus);

    // Execute the query
    await request.query(insertQuery);

    // Send success response
    res.status(200).json({
      status:200,
      message: "Insight saved successfully",
    });
  } catch (error) {
    console.error("Error saving insights:", error.message);

    // Send error response
    res.status(500).json({
      status:500,
      message: "Error saving insights",
      error: error.message,
    });
  }
});

  // Start the server
app.listen(5050, () => {
    console.log("Server has started at port 5050");
  });
  