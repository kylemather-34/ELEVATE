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

    return 0;
}
