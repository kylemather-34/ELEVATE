// llm_scanner_boilerplate.cpp
// C++ backend: HTTP server that accepts Python code and queries Ollama

#include <iostream>
#include <string>
#include <thread>
#include <nlohmann/json.hpp>
#include <httplib.h>  // https://github.com/yhirose/cpp-httplib

using json = nlohmann::json;
using namespace httplib;

std::string query_ollama(const std::string& code_snippet) {
    Client cli("localhost", 11434); // Ollama server

    json req = {
        {"model", "codellama:python"},
        {"prompt", "You are reviewing this Python function written by a student. Identify any weaknesses that would not be acceptable in production-level code and suggest improvements.\n\n" + code_snippet},
        {"stream", false}
    };

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

int main() {
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
