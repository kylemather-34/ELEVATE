#include <iostream>
#include <fstream>
#include <string>

using namespace std;

int main(int argc, char *argv[]){
    string inputFile = "../../parser/parserOutput.json"; // Will likely need to be updated

    // Open the text file
    ifstream file(inputFile);
    if (!file.is_open())
    {
        cerr << "Error: Could not open file " << inputFile << "\n";
        return 1;
    }
}