// llm_scanner_boilerplate.cpp
// C++ backend: HTTP server that accepts Python code and queries Ollama

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <nlohmann/json.hpp>
#include <httplib.h>  // https://github.com/yhirose/cpp-httplib

using json = nlohmann::json;
using namespace httplib;

std::string query_ollama(const std::string& code_snippet) {
    Client cli("localhost", 11434); // Ollama server

    json req = {
        {"model", "codellama:instruct"},
        { "prompt", "Act as a code reviewer. Review the following Python code written by a student. Return a JSON array of objects where each object includes:\n- 'line' (int): the line number with an issue\n- 'severity' (string): one of 'info', 'warning', or 'error'\n- 'message' (string): a short explanation.\nIf no problems exist, return an empty array [].\n\nCode:\n" + code_snippet },
        {"stream", false}
    };

    std::cout << "[Debug] Prompt sent to Ollama:\n" << req["prompt"] << std::endl;

    auto res = cli.Post("/api/generate", req.dump(), "application/json");

    if (res && res->status == 200) {
        try {
            json response = json::parse(res->body);
            return response["response"];
        } catch (...) {
            return "[Error parsing Ollama response]";
        }
    } else {
        return "[Error communicating with Ollama]";
    }
}

bool is_ollama_running() {
    httplib::Client cli("localhost", 11434);
    auto res = cli.Get("/"); // Simple ping
    return res != nullptr && res->status == 200;
}

void start_ollama_background() {
    std::cout << "[*] Ollama is not running. Attempting to start it..." << std::endl;

    std::system("start /B cmd /C \"ollama run codellama:instruct\"");

    // Recheck connectivity
    if (is_ollama_running()) {
        std::cout << "[+] Ollama started successfully." << std::endl;
    } else {
        std::cerr << "[-] Failed to start Ollama. Please run it manually." << std::endl;
    }
}

int main() {
    if (!is_ollama_running()) {
        start_ollama_background();
    }

    Server svr;

    svr.Post("/analyze", [](const Request& req, Response& res) {
        try {
            auto payload = json::parse(req.body);
            std::string code = payload["code"];
            std::string result = query_ollama(code);

            json response = {
                {"message", result}
            };

            res.set_content(response.dump(2), "application/json");
        } catch (...) {
            res.status = 400;
            res.set_content("{\"error\":\"Invalid request\"}", "application/json");
        }
    });

    std::cout << "[+] Backend running on http://localhost:5000" << std::endl;
    svr.listen("localhost", 5000);
    return 0;
}
