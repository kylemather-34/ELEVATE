#include <iostream>
#include <fstream>
#include <string>
#include "../../cpp_utils/json.hpp"

using namespace std;
using json = nlohmann::json;

int main(int argc, char *argv[]){
    string inputFile = "../../parser/parserOutput.json"; // Will likely need to be updated

    // Open the text file
    ifstream inFile(inputFile);
    if (!inFile.is_open())
    {
        cerr << "Error: Could not open file " << inputFile << "\n";
        return 1;
    }
    json parsedData;
    inFile >> parsedData;

    string role = "Role:\nYou are an AI specialized in analyzing Python program structure.\n\n";
    string context = "Context:\nThe following JSON describes the structural block events extracted from a Python program.\n\n";
    string task = "Task:\nAnalyze the program structure.\n\n";
    string hints = "Hints:\nTrack nested blocks using indentation\nLook for deeply nested logic\n\n";
    string outputFormat = "Output format:\n1. Structural summary\n2. Potential issues\n3. Complexity observations\n4. Suggested improvements";

    ofstream outFile("ai_input.txt");
    if (!outFile.is_open()){
        cerr << "Error: could not open output file\n";
        return 1;
    }

    outFile << role << context << task << hints << parsedData.dump(4) << "\n\n" << outputFormat;

    inFile.close();
    outFile.close();

    return 0;
}