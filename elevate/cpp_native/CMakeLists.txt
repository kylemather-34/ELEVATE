cmake_minimum_required(VERSION 3.20)
project(ELEVATE)

set(CMAKE_CXX_STANDARD 17)

# Add subdirectoreies
add_subdirectory(cpp_utils)
add_subdirectory(parser)
add_subdirectory(prompt_builder)
#add_subdirectory(ollama_client)