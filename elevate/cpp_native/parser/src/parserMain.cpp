#include "parserClass.hpp"
#include "json.hpp"

using json = nlohmann::json;


int main(int argc, char* argv[]) {
    // Check if a filename was provided
    if (argc != 2) {
        cerr << "Usage: " << argv[0] << " <input_file\n";
        return 1;
    }

    string inputFile = argv[1];

    // Open the text file
    ifstream file(inputFile);
    if (!file.is_open()) {
        cerr << "Error: Could not open file " << inputFile << "\n";
        return 1;
    }

    Parser parser;
    vector<BlockEvent> events = parser.parseFile(file);

    json output = json::array();

    for (const auto& event : events){
        json obj;

        obj["event"] = event.isStart ? "start" : "end";
        obj["type"] = blockTypeToString(event.type);
        obj["line"] = event.lineNumber;
        obj["indent"] = event.indentLevel;
        obj["text"] = event.lineText;

        output.push_back(obj);
    }

    ofstream outFile("output.json");

    if (!outFile.is_open()){
        cerr << "Error: Could not create output.json\n";
    }

    outFile << output.dump(4);

    file.close();
    outFile.close();
    return 0;
}