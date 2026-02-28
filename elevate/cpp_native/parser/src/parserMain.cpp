#include "parserClass.hpp"


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
    }

    Parser parser;
    vector<blockEvent> events = parser.parseFile(file);

    // Debug print
    for(const auto& event : events) {
        cout << (event.isStart ? "Start: " : "End: ")
             << "Line " << event.lineNumber
             << " Indent " << event.indentLevel
             << " Text: " << event.lineText << endl;
    }

    return 0;
}
