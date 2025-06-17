package com.example.kalakrutleadgen // Make sure this matches your package name

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.gson.Gson // For JSON parsing
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

class MainActivity : AppCompatActivity() {

    // --- IMPORTANT: Replace with your actual deployed Web app URL ---
    private val WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwUQq3ryH3voyZeiOIx2l3WwI5cRRoI9-BF05e4gDDFR9FLsFDqjhYK1_s4mV4lveM3-A/exec"
    // Example: "https://script.google.com/macros/s/AKfycbz_YOUR_ID_HERE_j4S/exec"

    private val client = OkHttpClient()
    private val gson = Gson() // Initialize Gson for JSON serialization/deserialization

    private lateinit var chatDisplay: TextView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        chatDisplay = findViewById(R.id.chatDisplay)
        messageInput = findViewById(R.id.messageInput)
        sendButton = findViewById(R.id.sendButton)

        sendButton.setOnClickListener {
            val query = messageInput.text.toString().trim()
            if (query.isNotEmpty()) {
                addMessageToChat("You", query)
                messageInput.text.clear() // Clear input field
                sendQueryToAgent(query)
            }
        }

        // Allow sending with Enter key
        messageInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEND) {
                sendButton.performClick()
                true
            } else {
                false
            }
        }
    }

    private fun addMessageToChat(sender: String, message: String) {
        runOnUiThread {
            chatDisplay.append("\n$sender: $message")
        }
    }

    private fun sendQueryToAgent(query: String) {
        // Construct the JSON request body
        val json = JSONObject().apply {
            put("query", query)
        }.toString()

        val requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), json)

        val request = Request.Builder()
            .url(WEB_APP_URL)
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("KalaKrut", "Error sending query: ${e.message}")
                addMessageToChat("Agent", "Sorry, I couldn't connect. Please try again.")
            }

            override fun onResponse(call: Call, response: Response) {
                response.body?.use { responseBody ->
                    if (!response.isSuccessful) {
                        val errorMsg = responseBody.string()
                        Log.e("KalaKrut", "Unsuccessful response: ${response.code} - $errorMsg")
                        addMessageToChat("Agent", "Error from server: ${response.code} - $errorMsg")
                    } else {
                        val jsonResponse = JSONObject(responseBody.string())
                        val agentResponse = jsonResponse.optString("response", "No response from agent.")
                        Log.d("KalaKrut", "Agent Response: $agentResponse")
                        addMessageToChat("Agent", agentResponse)
                    }
                }
            }
        })
    }
}
